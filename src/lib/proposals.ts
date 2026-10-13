import { createHash } from "node:crypto";
import type { Prisma, Proposal, ProposalStatus } from "@prisma/client";
import { appUrl } from "@/lib/app-url";
import { encrypt, randomToken } from "@/lib/crypto";
import { addDays, parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { changeDealStage, logActivity } from "@/lib/deals";
import { customProposalEmail, queueEmail } from "@/lib/email";
import { emitEvent } from "@/lib/events";
import { getFirmSettings, proposalNumber } from "@/lib/firm";
import { enqueue } from "@/lib/jobs";
import { computeTotals, dueNow, formatRand, monthlyTotal } from "@/lib/money";
import { notify } from "@/lib/notify";
import { initializeTransaction, paystackMode, verifyTransaction } from "@/lib/paystack";
import { docContext, proposalDoc, templateDoc } from "@/lib/proposal-content";
import { mergeFields } from "@/lib/proposal-doc";
import { mergeValues } from "@/components/proposal/document";

export const proposalInclude = {
  lineItems: { orderBy: { position: "asc" } },
  deal: { select: { id: true, name: true, contactName: true, email: true, ownerId: true, stage: true } },
} satisfies Prisma.ProposalInclude;

export type ProposalWithLines = Prisma.ProposalGetPayload<{ include: typeof proposalInclude }>;

export type DisplayStatus = ProposalStatus | "EXPIRED";

/** Open proposals past their valid-until date show (and behave) as expired. */
export function displayStatus(p: Pick<Proposal, "status" | "validUntil">): DisplayStatus {
  const open = p.status === "DRAFT" || p.status === "SENT" || p.status === "VIEWED";
  return open && p.validUntil.toISOString().slice(0, 10) < todayISO() ? "EXPIRED" : p.status;
}

export const STATUS_LABELS: Record<DisplayStatus, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Awaiting acceptance", tone: "brand" },
  VIEWED: { label: "Viewed", tone: "brand" },
  SIGNED: { label: "Signed, awaiting payment", tone: "warning" },
  ACCEPTED: { label: "Accepted & paid", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "danger" },
};

export function totalsOf(p: Pick<Proposal, "onceOffExVat" | "onceOffVat" | "monthlyExVat" | "monthlyVat">) {
  return { dueNow: dueNow(p), monthly: monthlyTotal(p), onceOff: p.onceOffExVat + p.onceOffVat };
}

export async function recalcProposal(id: string) {
  const p = await db.proposal.findUniqueOrThrow({ where: { id }, include: { lineItems: true } });
  const t = computeTotals(p.lineItems, p.vatRatePercent);
  return db.proposal.update({ where: { id }, data: t });
}

/** Creates a draft proposal for a deal, optionally pre-filled from a service package. */
export async function createProposal(dealId: string, actorId: string, packageId?: string | null) {
  const [deal, firm] = await Promise.all([db.deal.findUniqueOrThrow({ where: { id: dealId } }), getFirmSettings()]);
  const pkg = packageId ? await db.servicePackage.findUnique({ where: { id: packageId }, include: { items: { include: { service: true } } } }) : null;
  const proposal = await db.proposal.create({
    data: {
      title: pkg ? `${pkg.name} for ${deal.name}` : `Proposal for ${deal.name}`,
      dealId,
      content: templateDoc(firm) as Prisma.InputJsonValue,
      validUntil: parseISODate(addDays(todayISO(), firm.proposalValidityDays))!,
      // Services start on acceptance unless a date is chosen.
      startDate: null,
      vatRatePercent: firm.vatRegistered ? firm.vatRatePercent : 0,
      publicToken: randomToken(),
      createdById: actorId,
      lineItems: pkg
        ? {
            create: pkg.items.map((i, n) => ({
              serviceId: i.serviceId,
              name: i.service.name,
              description: i.service.description,
              billingType: i.service.billingType,
              quantity: i.quantity,
              unitPriceCents: i.priceCents ?? i.service.priceCents,
              taxable: i.service.taxable,
              position: n,
            })),
          }
        : undefined,
    },
  });
  await recalcProposal(proposal.id);
  await logActivity(dealId, "SYSTEM", `Proposal ${proposalNumber(proposal.number)} drafted.`, actorId);
  return proposal;
}

/** Fingerprint of exactly what the client agreed to, stored with their acceptance. */
export function proposalHash(p: ProposalWithLines) {
  const content = {
    number: p.number,
    title: p.title,
    introduction: p.introduction,
    terms: p.terms,
    content: p.content ?? null,
    validUntil: p.validUntil.toISOString(),
    startDate: p.startDate?.toISOString() ?? null,
    vat: p.vatRatePercent,
    lines: p.lineItems.map((l) => [l.name, l.description, l.billingType, l.quantity, l.unitPriceCents, l.taxable]),
    totals: [p.onceOffExVat, p.onceOffVat, p.monthlyExVat, p.monthlyVat],
  };
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export const publicUrl = (token: string) => appUrl(`/p/${token}`);

type Fail = { ok: false; error: string };
type Ok<T = object> = { ok: true } & T;

export async function sendProposal(id: string, actor: { id: string; name: string }): Promise<Ok | Fail> {
  const p = await db.proposal.findUniqueOrThrow({ where: { id }, include: proposalInclude });
  if (!p.deal.email) return { ok: false, error: "The lead has no email address. Add one on the deal first." };
  if (!p.lineItems.length) return { ok: false, error: "Add at least one service before sending." };
  if (!["DRAFT", "SENT", "VIEWED"].includes(p.status)) return { ok: false, error: "This proposal can no longer be sent." };
  if (displayStatus(p) === "EXPIRED") return { ok: false, error: "The valid-until date has passed. Extend it before sending." };

  await db.proposal.update({ where: { id }, data: { status: p.status === "DRAFT" ? "SENT" : p.status, sentAt: new Date() } });
  const firm = await getFirmSettings();
  const doc = proposalDoc(p, firm);
  const values = { ...mergeValues(await docContext(p, firm), doc), senderName: actor.name };
  const mail = customProposalEmail({
    subject: mergeFields(doc.email.subject, values, false),
    body: mergeFields(doc.email.body, values, false),
    url: publicUrl(p.publicToken),
    color: doc.theme.color,
  });
  await queueEmail({ to: p.deal.email, ...mail, senderId: actor.id, dealId: p.dealId });
  await logActivity(p.dealId, "SYSTEM", `Proposal ${proposalNumber(p.number)} sent to ${p.deal.email}.`, actor.id);

  if (["NEW_LEAD", "DISCOVERY_BOOKED", "DISCOVERY_COMPLETED", "PROPOSAL_REQUIRED"].includes(p.deal.stage)) {
    await changeDealStage(p.dealId, "PROPOSAL_SENT", { actorId: actor.id });
  }
  // The "Prepare proposal" task is done once it's sent.
  await db.task.updateMany({ where: { dealId: p.dealId, automationKey: "deal.proposal", status: { not: "DONE" } }, data: { status: "DONE", completedAt: new Date() } });
  await emitEvent("proposal.sent", { proposalId: id }, { actorId: actor.id });
  return { ok: true };
}

export async function markViewed(p: ProposalWithLines) {
  if (p.viewedAt || p.status === "DRAFT") return;
  await db.proposal.update({ where: { id: p.id }, data: { viewedAt: new Date(), status: p.status === "SENT" ? "VIEWED" : p.status } });
  await logActivity(p.dealId, "SYSTEM", `${p.deal.contactName} opened proposal ${proposalNumber(p.number)}.`);
  await notify([p.deal.ownerId], "system", { title: `${p.deal.name} opened their proposal`, link: `/proposals/${p.id}` });
}

function canAccept(p: ProposalWithLines): Fail | null {
  const s = displayStatus(p);
  if (s === "EXPIRED") return { ok: false, error: "This proposal has expired. Please contact us for an updated one." };
  if (s !== "SENT" && s !== "VIEWED") return { ok: false, error: "This proposal can't be accepted any more." };
  return null;
}

/** Client accepts on the proposal page by typing their name. */
export async function acceptByClick(token: string, signer: { name: string; ip: string; userAgent: string }): Promise<Ok | Fail> {
  const p = await db.proposal.findUnique({ where: { publicToken: token }, include: proposalInclude });
  if (!p) return { ok: false, error: "Proposal not found." };
  const blocked = canAccept(p);
  if (blocked) return blocked;
  await db.proposal.update({
    where: { id: p.id },
    data: { status: "SIGNED", signedAt: new Date(), signatureMethod: "CLICK_TO_ACCEPT", signedName: signer.name, signedIp: signer.ip, signedUserAgent: signer.userAgent.slice(0, 500), signedHash: proposalHash(p) },
  });
  await logActivity(p.dealId, "SYSTEM", `${signer.name} accepted proposal ${proposalNumber(p.number)} online.`);
  await notify([p.deal.ownerId], "system", { title: `${p.deal.name} accepted their proposal`, body: totalsOf(p).dueNow ? "Waiting for payment" : undefined, link: `/proposals/${p.id}` });
  await emitEvent("proposal.signed", { proposalId: p.id });
  return { ok: true };
}

/** Staff upload a proposal the client signed on paper or elsewhere. */
export async function recordUploadedSignature(id: string, file: File, actor: { id: string; name: string }): Promise<Ok | Fail> {
  const p = await db.proposal.findUniqueOrThrow({ where: { id }, include: proposalInclude });
  if (!["DRAFT", "SENT", "VIEWED"].includes(p.status)) return { ok: false, error: "This proposal is already signed or closed." };
  if (file.type !== "application/pdf") return { ok: false, error: "Upload the signed proposal as a PDF." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "The PDF must be 10 MB or smaller." };
  const stored = await db.storedFile.create({
    data: { name: file.name, contentType: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()), uploadedById: actor.id },
  });
  await db.proposal.update({
    where: { id },
    data: { status: "SIGNED", signedAt: new Date(), signatureMethod: "UPLOADED_PDF", signedName: `Uploaded by ${actor.name}`, signedFileId: stored.id, signedHash: proposalHash(p) },
  });
  await logActivity(p.dealId, "SYSTEM", `Signed proposal ${proposalNumber(p.number)} uploaded by ${actor.name}.`, actor.id);
  await emitEvent("proposal.signed", { proposalId: id }, { actorId: actor.id });
  return { ok: true };
}

/** Starts checkout for a signed proposal. Returns the URL to send the client to. */
export async function startCheckout(token: string): Promise<Ok<{ url: string }> | Fail> {
  const p = await db.proposal.findUnique({ where: { publicToken: token }, include: proposalInclude });
  if (!p) return { ok: false, error: "Proposal not found." };
  if (p.status !== "SIGNED" || p.paidAt) return { ok: false, error: "This proposal isn't waiting for payment." };
  if (!p.deal.email) return { ok: false, error: "No email on file. Please contact us." };
  const mode = paystackMode();
  if (mode === "off") return { ok: false, error: "Online payment isn't available yet. Please contact us to pay by EFT." };

  const amount = totalsOf(p).dueNow;
  const reference = `OUT${p.number}-${randomToken(6)}`;
  await db.payment.create({ data: { proposalId: p.id, provider: mode === "simulated" ? "SIMULATED" : "PAYSTACK", reference, amountCents: amount } });

  if (mode === "simulated") return { ok: true, url: appUrl(`/p/${token}/simulate?reference=${reference}`) };
  const tx = await initializeTransaction({
    email: p.deal.email,
    amountCents: amount,
    reference,
    callbackUrl: appUrl(`/p/${token}/paid`),
    metadata: { proposalId: p.id, proposalNumber: proposalNumber(p.number), client: p.deal.name },
    cardOnly: p.monthlyExVat > 0,
  });
  return { ok: true, url: tx.authorization_url };
}

type VerifiedPayment = { amount: number; currency: string; channel: string; customerCode?: string; authorizationCode?: string | null };

/**
 * Marks a payment successful. Safe to call more than once (callback page,
 * webhook and retries all land here). Checks the amount and currency
 * against what we asked for.
 */
export async function confirmPayment(reference: string, v: VerifiedPayment) {
  const payment = await db.payment.findUnique({ where: { reference }, include: { proposal: true } });
  if (!payment) throw new Error(`Unknown payment reference ${reference}`);
  if (payment.status === "SUCCESS") return payment;
  if (v.currency !== "ZAR" || v.amount < payment.amountCents) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", note: `Amount/currency mismatch: got ${v.amount} ${v.currency}` } });
    throw new Error(`Payment ${reference} amount mismatch`);
  }

  const p = payment.proposal;
  await db.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", paidAt: new Date(), channel: v.channel, customerCode: v.customerCode } });
    await tx.proposal.update({ where: { id: p.id }, data: { paidAt: new Date() } });
  });
  await logActivity(p.dealId, "SYSTEM", `Payment of ${formatRand(payment.amountCents)} received (${payment.provider.toLowerCase()}, ${v.channel}). Ref ${reference}.`);

  if (p.monthlyExVat > 0) {
    const sub = await db.subscription.create({
      data: {
        proposalId: p.id,
        provider: payment.provider,
        amountCents: monthlyTotal(p),
        // Paystack subscriptions are created below; simulated and manual (EFT) ones are simply active.
        status: payment.provider === "PAYSTACK" ? "PENDING" : "ACTIVE",
        nextPaymentDate: parseISODate(firstRenewal(p.startDate)),
      },
    });
    if (payment.provider === "PAYSTACK") {
      await enqueue("paystack.subscribe", {
        subscriptionId: sub.id,
        customerCode: v.customerCode ?? null,
        authorization: v.authorizationCode ? encrypt(v.authorizationCode) : null,
      });
    }
  }
  await emitEvent("payment.succeeded", { proposalId: p.id, reference }, { idempotencyKey: `payment:${reference}` });
  return payment;
}

/** First monthly charge after the up-front payment: one month after the start date (or today). */
export function firstRenewal(startDate: Date | null) {
  const start = startDate && startDate.toISOString().slice(0, 10) > todayISO() ? startDate.toISOString().slice(0, 10) : todayISO();
  const [y, m, d] = start.split("-").map(Number) as [number, number, number];
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
}

/** Called from the Paystack callback page and webhook: asks Paystack, then confirms. */
export async function verifyAndConfirm(reference: string) {
  const mode = paystackMode();
  if (mode !== "test" && mode !== "live") return null;
  const tx = await verifyTransaction(reference);
  if (tx.status !== "success") {
    await db.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: tx.status === "failed" ? "FAILED" : "PENDING", note: tx.status } });
    return null;
  }
  return confirmPayment(reference, {
    amount: tx.amount,
    currency: tx.currency,
    channel: tx.channel,
    customerCode: tx.customer.customer_code,
    authorizationCode: tx.authorization?.reusable ? tx.authorization.authorization_code : null,
  });
}

/** Staff record an EFT or other offline payment. */
export async function recordManualPayment(id: string, actor: { id: string; name: string }, note: string): Promise<Ok | Fail> {
  const p = await db.proposal.findUniqueOrThrow({ where: { id } });
  if (p.paidAt) return { ok: false, error: "This proposal is already paid." };
  if (!["SIGNED", "SENT", "VIEWED"].includes(p.status)) return { ok: false, error: "Only sent or signed proposals can be marked as paid." };
  const reference = `MANUAL-${p.number}-${randomToken(4)}`;
  await db.payment.create({ data: { proposalId: id, provider: "MANUAL", reference, amountCents: totalsOf(p).dueNow, note: `${note} (recorded by ${actor.name})` } });
  // Monthly fees for manual payers are invoiced outside Paystack.
  await confirmPayment(reference, { amount: totalsOf(p).dueNow, currency: "ZAR", channel: "eft" });
  return { ok: true };
}

/** Signed + paid → accepted. Runs after either event; only the last one completes it. */
export async function finalizeIfComplete(proposalId: string) {
  const p = await db.proposal.findUnique({ where: { id: proposalId } });
  if (!p || p.status !== "SIGNED") return;
  const needsPayment = totalsOf(p).dueNow > 0;
  if (needsPayment && !p.paidAt) return;
  const { count } = await db.proposal.updateMany({ where: { id: proposalId, status: "SIGNED" }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
  if (count) await emitEvent("proposal.accepted", { proposalId }, { idempotencyKey: `accepted:${proposalId}` });
}

/**
 * A monthly retainer charge (Paystack creates a new reference every month).
 * Matched to our subscription by plan code and re-verified with Paystack.
 */
export async function recordRenewal(reference: string, planCode: string) {
  if (await db.payment.findUnique({ where: { reference } })) return null;
  const sub = await db.subscription.findFirst({ where: { planCode }, include: { proposal: true } });
  if (!sub) return null;
  const tx = await verifyTransaction(reference);
  if (tx.status !== "success" || tx.currency !== "ZAR") return null;
  const payment = await db.payment.create({
    data: { proposalId: sub.proposalId, provider: "PAYSTACK", reference, amountCents: tx.amount, status: "SUCCESS", channel: tx.channel, customerCode: tx.customer.customer_code, paidAt: tx.paid_at ? new Date(tx.paid_at) : new Date(), isRenewal: true, note: "Monthly retainer" },
  });
  await db.subscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", lastError: null } });
  await logActivity(sub.proposal.dealId, "SYSTEM", `Monthly retainer payment of ${formatRand(tx.amount)} received. Ref ${reference}.`);
  return payment;
}
