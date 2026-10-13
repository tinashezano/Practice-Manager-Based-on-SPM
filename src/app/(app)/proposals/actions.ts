"use server";

import { BillingType, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/deals";
import { getFirmSettings, proposalNumber } from "@/lib/firm";
import { parseRand } from "@/lib/money";
import { createProposal, recalcProposal, recordManualPayment, recordUploadedSignature, sendProposal } from "@/lib/proposals";
import { docSchema } from "@/lib/proposal-doc";
import { proposalDoc } from "@/lib/proposal-content";
import { sanitizeDoc } from "@/lib/sanitize";
import { requirePermission } from "@/lib/session";
import { saveFile } from "@/lib/storage";

type Result = { ok: true } | { ok: false; error: string };
export type FormState = { error?: string; ok?: string };

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const money = z.string().transform((s, ctx) => {
  const c = parseRand(s);
  if (c === null) ctx.addIssue({ code: "custom", message: "Enter a valid amount, e.g. 2500 or 2500.50" });
  return c ?? 0;
});

// ---------- Services ----------

const serviceSchema = z.object({
  id: z.preprocess(blank, z.string().nullable().optional()),
  name: z.string().trim().min(2, "Name the service").max(150),
  description: z.preprocess(blank, z.string().trim().max(2000).nullable().optional()),
  billingType: z.nativeEnum(BillingType),
  price: money,
  taxable: z.boolean(),
  active: z.boolean(),
  templateId: z.preprocess(blank, z.string().nullable().optional()),
});

export async function saveService(_: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("settings.manage");
  const parsed = serviceSchema.safeParse({ ...Object.fromEntries(fd), taxable: fd.get("taxable") === "on", active: fd.get("active") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { id, price, ...data } = parsed.data;
  if (id) await db.service.update({ where: { id }, data: { ...data, priceCents: price } });
  else await db.service.create({ data: { ...data, priceCents: price, position: await db.service.count() } });
  revalidatePath("/proposals/services");
  return { ok: "Saved." };
}

// ---------- Packages ----------

const packageSchema = z.object({
  id: z.string().nullable(),
  name: z.string().trim().min(2, "Name the package").max(150),
  description: z.string().trim().max(2000).nullable(),
  active: z.boolean(),
  items: z.array(z.object({ serviceId: z.string().min(1), quantity: z.number().int().min(1).max(100), priceCents: z.number().int().min(0).nullable() })).min(1, "Add at least one service"),
});

export async function savePackage(input: z.input<typeof packageSchema>): Promise<Result> {
  await requirePermission("settings.manage");
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { id, items, ...data } = parsed.data;
  await db.$transaction(async (tx) => {
    const pkg = id ? await tx.servicePackage.update({ where: { id }, data }) : await tx.servicePackage.create({ data });
    await tx.servicePackageItem.deleteMany({ where: { packageId: pkg.id } });
    await tx.servicePackageItem.createMany({ data: items.map((i) => ({ ...i, packageId: pkg.id })) });
  });
  revalidatePath("/proposals/packages");
  return { ok: true };
}

// ---------- Proposals ----------

export async function newProposal(fd: FormData) {
  const actor = await requirePermission("proposals.manage");
  const dealId = String(fd.get("dealId") ?? "");
  if (!(await db.deal.findUnique({ where: { id: dealId } }))) redirect("/proposals");
  const p = await createProposal(dealId, actor.id, (fd.get("packageId") as string) || null);
  redirect(`/proposals/${p.id}`);
}

async function editable(id: string) {
  const p = await db.proposal.findUniqueOrThrow({ where: { id } });
  if (!["DRAFT", "SENT", "VIEWED"].includes(p.status)) throw new Error("Signed or closed proposals can't be changed.");
  return p;
}

function wrap(fn: () => Promise<void>): Promise<Result> {
  return fn().then(
    () => ({ ok: true as const }),
    (err) => {
      if (err && typeof err === "object" && "digest" in err) throw err; // redirect()
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    },
  );
}

const builderSchema = z.object({
  title: z.string().trim().min(2, "Give the proposal a title").max(200),
  validUntil: z.string(),
  startDate: z.string().nullable(),
  doc: docSchema,
});

/** Autosave from the proposal builder: general details plus the whole document. */
export async function saveProposal(id: string, input: z.input<typeof builderSchema>): Promise<Result & { savedAt?: string }> {
  await requirePermission("proposals.manage");
  return wrap(async () => {
    await editable(id);
    const parsed = builderSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Couldn't save the proposal");
    const d = parsed.data;
    const validUntil = parseISODate(d.validUntil);
    if (!validUntil) throw new Error("Choose a valid-until date");
    await db.proposal.update({
      where: { id },
      data: { title: d.title, validUntil, startDate: parseISODate(d.startDate), content: sanitizeDoc(d.doc) as Prisma.InputJsonValue },
    });
  }).then((r) => (r.ok ? { ...r, savedAt: new Date().toISOString() } : r));
}

const ASSET_TYPES = { image: ["image/png", "image/jpeg", "image/webp"], document: ["application/pdf", "image/png", "image/jpeg", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] };

/** Pictures, logos and brochures for proposals. These are visible to anyone with the proposal link. */
export async function uploadProposalAsset(fd: FormData): Promise<{ ok: true; id: string; name: string; url: string } | { ok: false; error: string }> {
  const actor = await requirePermission("proposals.manage");
  const file = fd.get("file");
  const kind = fd.get("kind") === "document" ? "document" : "image";
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose a file" };
  if (!ASSET_TYPES[kind].includes(file.type)) return { ok: false, error: kind === "image" ? "Use a PNG, JPEG or WebP picture." : "Use a PDF, Word, Excel or picture file." };
  if (kind === "image" && file.size > 5 * 1024 * 1024) return { ok: false, error: "Pictures must be 5 MB or smaller." };
  try {
    const f = await saveFile(file, { purpose: "PUBLIC_ASSET", uploadedById: actor.id });
    return { ok: true, id: f.id, name: f.name, url: `/api/assets/${f.id}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
  }
}

/** Makes this proposal's layout, wording and theme the starting point for new proposals. */
export async function saveAsTemplate(id: string): Promise<Result> {
  await requirePermission("settings.manage");
  return wrap(async () => {
    const [p, firm] = await Promise.all([db.proposal.findUniqueOrThrow({ where: { id } }), getFirmSettings()]);
    const doc = proposalDoc(p, firm);
    // Documents attached to one client's proposal don't belong in the template.
    const template = { ...doc, sections: doc.sections.map((s) => ({ ...s, files: [] })) };
    await db.firmSettings.update({ where: { id: "firm" }, data: { proposalTemplate: template as Prisma.InputJsonValue } });
  });
}

export async function addServiceLine(id: string, serviceId: string): Promise<Result> {
  await requirePermission("proposals.manage");
  return wrap(async () => {
    await editable(id);
    const s = await db.service.findUniqueOrThrow({ where: { id: serviceId } });
    const position = await db.proposalLineItem.count({ where: { proposalId: id } });
    await db.proposalLineItem.create({ data: { proposalId: id, serviceId: s.id, name: s.name, description: s.description, billingType: s.billingType, unitPriceCents: s.priceCents, taxable: s.taxable, position } });
    await recalcProposal(id);
    revalidatePath(`/proposals/${id}`);
  });
}

export async function addPackageLines(id: string, packageId: string): Promise<Result> {
  await requirePermission("proposals.manage");
  return wrap(async () => {
    await editable(id);
    const pkg = await db.servicePackage.findUniqueOrThrow({ where: { id: packageId }, include: { items: { include: { service: true } } } });
    let position = await db.proposalLineItem.count({ where: { proposalId: id } });
    await db.proposalLineItem.createMany({
      data: pkg.items.map((i) => ({ proposalId: id, serviceId: i.serviceId, name: i.service.name, description: i.service.description, billingType: i.service.billingType, quantity: i.quantity, unitPriceCents: i.priceCents ?? i.service.priceCents, taxable: i.service.taxable, position: position++ })),
    });
    await recalcProposal(id);
    revalidatePath(`/proposals/${id}`);
  });
}

export async function addCustomLine(id: string, billingType: BillingType): Promise<Result> {
  await requirePermission("proposals.manage");
  return wrap(async () => {
    await editable(id);
    const position = await db.proposalLineItem.count({ where: { proposalId: id } });
    await db.proposalLineItem.create({ data: { proposalId: id, name: "Custom service", billingType, unitPriceCents: 0, position } });
    revalidatePath(`/proposals/${id}`);
  });
}

const lineSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000).nullable(),
    quantity: z.number().int().min(1).max(1000),
    price: money,
    billingType: z.nativeEnum(BillingType),
    taxable: z.boolean(),
  })
  .partial();

export async function updateLine(lineId: string, input: z.input<typeof lineSchema>): Promise<Result> {
  await requirePermission("proposals.manage");
  return wrap(async () => {
    const line = await db.proposalLineItem.findUniqueOrThrow({ where: { id: lineId } });
    await editable(line.proposalId);
    const { price, ...rest } = lineSchema.parse(input);
    await db.proposalLineItem.update({ where: { id: lineId }, data: { ...rest, ...(price !== undefined ? { unitPriceCents: price } : {}) } });
    await recalcProposal(line.proposalId);
    revalidatePath(`/proposals/${line.proposalId}`);
  });
}

export async function removeLine(lineId: string): Promise<Result> {
  await requirePermission("proposals.manage");
  return wrap(async () => {
    const line = await db.proposalLineItem.findUniqueOrThrow({ where: { id: lineId } });
    await editable(line.proposalId);
    await db.proposalLineItem.delete({ where: { id: lineId } });
    await recalcProposal(line.proposalId);
    revalidatePath(`/proposals/${line.proposalId}`);
  });
}

export async function send(id: string): Promise<Result> {
  const actor = await requirePermission("proposals.manage");
  const r = await sendProposal(id, actor);
  revalidatePath("/", "layout");
  return r.ok ? { ok: true } : r;
}

export async function uploadSigned(id: string, fd: FormData): Promise<Result> {
  const actor = await requirePermission("proposals.manage");
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose the signed PDF" };
  const r = await recordUploadedSignature(id, file, actor);
  revalidatePath("/", "layout");
  return r.ok ? { ok: true } : r;
}

export async function recordPayment(id: string, note: string): Promise<Result> {
  const actor = await requirePermission("settings.manage");
  if (!note.trim()) return { ok: false, error: "Add a note, e.g. the EFT reference" };
  const r = await recordManualPayment(id, actor, note.trim());
  revalidatePath("/", "layout");
  return r.ok ? { ok: true } : r;
}

export async function withdraw(id: string): Promise<Result> {
  const actor = await requirePermission("proposals.manage");
  return wrap(async () => {
    const p = await editable(id);
    await db.proposal.update({ where: { id }, data: { status: "WITHDRAWN" } });
    await logActivity(p.dealId, "SYSTEM", `Proposal ${proposalNumber(p.number)} withdrawn.`, actor.id);
    revalidatePath("/", "layout");
  });
}

export async function markDeclined(id: string, reason: string): Promise<Result> {
  const actor = await requirePermission("proposals.manage");
  return wrap(async () => {
    const p = await editable(id);
    await db.proposal.update({ where: { id }, data: { status: "DECLINED", declinedReason: reason.trim() || null } });
    await logActivity(p.dealId, "SYSTEM", `Proposal ${proposalNumber(p.number)} declined.${reason.trim() ? ` ${reason.trim()}` : ""}`, actor.id);
    revalidatePath("/", "layout");
  });
}

export async function deleteDraft(id: string): Promise<Result> {
  await requirePermission("proposals.manage");
  const p = await db.proposal.findUniqueOrThrow({ where: { id } });
  if (p.status !== "DRAFT") return { ok: false, error: "Only drafts can be deleted. Withdraw sent proposals instead." };
  await db.proposal.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect(`/deals/${p.dealId}`);
}
