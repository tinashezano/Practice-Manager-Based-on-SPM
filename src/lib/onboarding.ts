import type { OnboardingItemStatus, OnboardingStage, Prisma } from "@prisma/client";
import { appUrl } from "@/lib/app-url";
import { getAutomation } from "@/lib/automations/settings";
import { randomToken } from "@/lib/crypto";
import { addDays, parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { itemReturnedEmail, onboardingCompleteEmail, onboardingReminderEmail, queueEmail } from "@/lib/email";
import { enqueue } from "@/lib/jobs";
import { notify } from "@/lib/notify";
import { buildChecklist } from "@/lib/onboarding-checklist";
import { saveFile } from "@/lib/storage";

export { STAGES, STAGE_INFO, TASK_KEYS } from "@/lib/onboarding-meta";
import { STAGE_INFO, TASK_KEYS } from "@/lib/onboarding-meta";

export const uploadUrl = (token: string) => appUrl(`/upload/${token}`);

export const onboardingInclude = {
  client: { include: { contacts: { orderBy: { isPrimary: "desc" } } } },
  items: { orderBy: [{ kind: "asc" }, { position: "asc" }], include: { files: { include: { file: { select: { id: true, name: true, size: true, uploadedByClient: true, createdAt: true } } } } } },
} satisfies Prisma.OnboardingInclude;

type Full = Prisma.OnboardingGetPayload<{ include: typeof onboardingInclude }>;

const done = (s: OnboardingItemStatus) => s === "ACCEPTED" || s === "NOT_APPLICABLE" || s === "DONE";
const submitted = (s: OnboardingItemStatus) => s === "RECEIVED" || done(s);

export function progress(items: { kind: string; required: boolean; status: OnboardingItemStatus }[]) {
  const info = items.filter((i) => i.kind === "INFO");
  const setup = items.filter((i) => i.kind === "SETUP");
  return {
    infoReceived: info.filter((i) => submitted(i.status)).length,
    infoTotal: info.length,
    infoAccepted: info.filter((i) => done(i.status)).length,
    setupDone: setup.filter((i) => done(i.status)).length,
    setupTotal: setup.length,
    outstanding: info.filter((i) => i.required && (i.status === "PENDING" || i.status === "REJECTED")),
  };
}

function clientContact(o: Full) {
  const contact = o.client.contacts.find((c) => c.email) ?? null;
  return { email: contact?.email ?? o.client.email, name: contact?.name ?? o.client.name };
}

export async function logOnboarding(onboardingId: string, body: string, opts: { actorId?: string | null; byClient?: boolean } = {}) {
  await db.onboardingActivity.create({ data: { onboardingId, body, actorId: opts.actorId ?? null, byClient: opts.byClient ?? false } });
}

async function defaultReviewer(ownerId: string | null) {
  const directors = await db.user.findMany({ where: { role: "DIRECTOR", active: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return (directors.find((d) => d.id !== ownerId) ?? directors[0])?.id ?? ownerId;
}

/** Starts onboarding for a client with a checklist based on what they bought. Returns the existing one if already open. */
export async function startOnboarding(clientId: string, opts: { ownerId: string | null; actorId: string | null; services: string[]; proposalId?: string | null }) {
  const open = await db.onboarding.findFirst({ where: { clientId, stage: { not: "COMPLETE" } } });
  if (open) return open;
  const client = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  const checklist = buildChecklist(client.entityType, opts.services);

  const onboarding = await db.onboarding.create({
    data: {
      clientId,
      ownerId: opts.ownerId,
      reviewerId: await defaultReviewer(opts.ownerId),
      proposalId: opts.proposalId ?? null,
      uploadToken: randomToken(32),
      items: {
        create: checklist.map((c, i) => ({ kind: c.kind, label: c.label, description: c.description ?? null, required: c.required ?? true, allowsText: c.allowsText ?? false, position: i })),
      },
    },
  });
  if (client.status !== "ONBOARDING") await db.client.update({ where: { id: clientId }, data: { status: "ONBOARDING" } });
  await db.task.create({
    data: {
      title: `Onboard ${client.name}`,
      description: "Track progress on the client's onboarding page. Reminders to the client go out automatically.",
      clientId,
      assigneeId: opts.ownerId,
      createdById: opts.actorId,
      dueDate: parseISODate(addDays(todayISO(), 14)),
      automationKey: TASK_KEYS.onboarding,
    },
  });
  await logOnboarding(onboarding.id, "Onboarding started. Information requested from the client.", { actorId: opts.actorId });

  const r = await getAutomation("onboarding.reminders");
  if (r.enabled) await enqueue("onboarding.reminder", { onboardingId: onboarding.id }, new Date(Date.now() + r.config.days! * 86_400_000));
  return onboarding;
}

/** What the client still needs to send, for emails. */
export async function outstandingLabels(onboardingId: string) {
  const items = await db.onboardingItem.findMany({ where: { onboardingId, kind: "INFO", required: true, status: { in: ["PENDING", "REJECTED"] } }, orderBy: { position: "asc" } });
  return items.map((i) => i.label);
}

// ---------- Stage changes ----------

async function closeTasks(clientId: string, key: string) {
  await db.task.updateMany({ where: { clientId, automationKey: key, status: { not: "DONE" } }, data: { status: "DONE", completedAt: new Date() } });
}

async function ensureTask(clientId: string, key: string, data: { title: string; description: string; assigneeId: string | null; priority?: "HIGH" }) {
  const exists = await db.task.findFirst({ where: { clientId, automationKey: key, status: { not: "DONE" } } });
  if (exists) return;
  await db.task.create({ data: { ...data, clientId, automationKey: key, dueDate: parseISODate(addDays(todayISO(), 2)) } });
}

/** Moves the onboarding to a stage and runs that stage's side effects. */
export async function setStage(onboardingId: string, stage: OnboardingStage, actorId: string | null, note?: string) {
  const o = await db.onboarding.findUniqueOrThrow({ where: { id: onboardingId }, include: onboardingInclude });
  if (o.stage === stage) return;
  await db.onboarding.update({ where: { id: o.id }, data: { stage, stageChangedAt: new Date(), completedAt: stage === "COMPLETE" ? new Date() : null } });
  await logOnboarding(o.id, `${STAGE_INFO[o.stage].label} → ${STAGE_INFO[stage].label}.${note ? ` ${note}` : ""}`, { actorId });
  const link = `/clients/${o.clientId}/onboarding`;

  if (stage === "INFO_RECEIVED") {
    await ensureTask(o.clientId, TASK_KEYS.reviewDocs, { title: `Check documents from ${o.client.name}`, description: "Accept each item or send it back with a reason on the onboarding page.", assigneeId: o.ownerId, priority: "HIGH" });
    await notify([o.ownerId], actorId ?? "system", { title: `${o.client.name} sent all their information`, link });
  }
  if (stage === "SETUP") {
    await closeTasks(o.clientId, TASK_KEYS.reviewDocs);
    await closeTasks(o.clientId, TASK_KEYS.chase);
    await notify([o.ownerId], actorId ?? "system", { title: `${o.client.name}: documents accepted, time to set up`, link });
  }
  if (stage === "REVIEW") {
    await ensureTask(o.clientId, TASK_KEYS.approve, { title: `Approve onboarding: ${o.client.name}`, description: "Check the setup and approve, or send it back to setup.", assigneeId: o.reviewerId ?? o.ownerId, priority: "HIGH" });
    await notify([o.reviewerId], actorId ?? "system", { title: `Onboarding ready for your review: ${o.client.name}`, link });
  }
  if (stage === "COMPLETE") {
    await db.client.update({ where: { id: o.clientId }, data: { status: "ACTIVE" } });
    for (const key of Object.values(TASK_KEYS)) await closeTasks(o.clientId, key);
    const to = clientContact(o);
    const owner = o.ownerId ? await db.user.findUnique({ where: { id: o.ownerId } }) : null;
    if (to.email) {
      await queueEmail({ to: to.email, ...onboardingCompleteEmail({ contactName: to.name, senderName: owner?.name ?? "Outset", ownerName: owner?.name ?? "our team" }), senderId: o.ownerId });
    }
    await notify([o.ownerId], actorId ?? "system", { title: `${o.client.name} is fully onboarded`, link: `/clients/${o.clientId}` });
  }
}

/** Moves forward automatically when the checklist allows it. */
export async function evaluate(onboardingId: string, actorId: string | null) {
  const o = await db.onboarding.findUniqueOrThrow({ where: { id: onboardingId }, include: { items: true } });
  const info = o.items.filter((i) => i.kind === "INFO" && i.required);
  const setup = o.items.filter((i) => i.kind === "SETUP" && i.required);
  const allSubmitted = info.every((i) => submitted(i.status));
  const allAccepted = info.every((i) => done(i.status));
  const setupDone = setup.every((i) => done(i.status));

  if (o.stage === "INFO_REQUESTED" && allSubmitted) {
    await setStage(o.id, "INFO_RECEIVED", actorId);
    return evaluate(o.id, actorId);
  }
  if (o.stage === "INFO_RECEIVED" && !allSubmitted) return setStage(o.id, "INFO_REQUESTED", actorId, "Waiting for the client to resend items.");
  if (o.stage === "INFO_RECEIVED" && allAccepted) {
    await setStage(o.id, "SETUP", actorId);
    return evaluate(o.id, actorId);
  }
  if (o.stage === "SETUP" && allAccepted && setupDone) return setStage(o.id, "REVIEW", actorId);
}

// ---------- Client side ----------

/** Client uploads files and/or types an answer for one checklist item. */
export async function clientSubmit(token: string, itemId: string, files: File[], answer: string | null) {
  const o = await db.onboarding.findUnique({ where: { uploadToken: token }, include: { client: true } });
  if (!o || o.stage === "COMPLETE") return { ok: false as const, error: "This upload link is no longer active." };
  const item = await db.onboardingItem.findFirst({ where: { id: itemId, onboardingId: o.id, kind: "INFO" }, include: { _count: { select: { files: true } } } });
  if (!item) return { ok: false as const, error: "Item not found." };
  if (item.status === "ACCEPTED" || item.status === "NOT_APPLICABLE") return { ok: false as const, error: "We've already got this one, thank you." };
  const text = answer?.trim() || null;
  if (!files.length && !text) return { ok: false as const, error: item.allowsText ? "Upload a file or type your answer." : "Choose a file to upload." };
  if (item._count.files + files.length > 15) return { ok: false as const, error: "That's too many files for one item. Combine them into a PDF or ZIP." };

  try {
    for (const f of files) {
      const stored = await saveFile(f, { purpose: "CLIENT_DOCUMENT", byClient: true });
      await db.onboardingFile.create({ data: { itemId: item.id, fileId: stored.id } });
    }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Upload failed." };
  }
  await db.onboardingItem.update({ where: { id: item.id }, data: { status: "RECEIVED", clientAnswer: text ?? item.clientAnswer, staffNote: null } });
  await logOnboarding(o.id, `Client sent: ${item.label}${files.length ? ` (${files.length} file${files.length === 1 ? "" : "s"})` : ""}.`, { byClient: true });
  await notify([o.ownerId], "system", { title: `${o.client.name} uploaded: ${item.label}`, link: `/clients/${o.clientId}/onboarding` });
  await evaluate(o.id, null);
  return { ok: true as const };
}

// ---------- Staff side ----------

export async function reviewItem(itemId: string, decision: "ACCEPTED" | "REJECTED" | "NOT_APPLICABLE" | "PENDING", note: string | null, actor: { id: string; name: string }) {
  const item = await db.onboardingItem.findUniqueOrThrow({ where: { id: itemId }, include: { onboarding: { include: onboardingInclude } } });
  if (decision === "REJECTED" && !note?.trim()) throw new Error("Tell the client what's wrong so they can fix it.");
  await db.onboardingItem.update({
    where: { id: itemId },
    data: { status: decision, staffNote: decision === "REJECTED" ? note!.trim() : null, completedById: done(decision) ? actor.id : null, completedAt: done(decision) ? new Date() : null },
  });
  const o = item.onboarding;
  const verb = { ACCEPTED: "accepted", REJECTED: "sent back", NOT_APPLICABLE: "marked not applicable", PENDING: "reset" }[decision];
  await logOnboarding(o.id, `${item.label} ${verb}${decision === "REJECTED" ? `: ${note}` : ""}.`, { actorId: actor.id });
  if (decision === "REJECTED") {
    const to = clientContact(o);
    if (to.email) await queueEmail({ to: to.email, ...itemReturnedEmail({ contactName: to.name, senderName: actor.name, item: item.label, note: note!, uploadUrl: uploadUrl(o.uploadToken) }), senderId: actor.id });
  }
  await evaluate(o.id, actor.id);
}

export async function toggleSetupItem(itemId: string, isDone: boolean, actorId: string) {
  const item = await db.onboardingItem.update({ where: { id: itemId }, data: { status: isDone ? "DONE" : "PENDING", completedById: isDone ? actorId : null, completedAt: isDone ? new Date() : null } });
  await logOnboarding(item.onboardingId, `${item.label}: ${isDone ? "done" : "reopened"}.`, { actorId });
  await evaluate(item.onboardingId, actorId);
}

// ---------- Reminders ----------

export async function sendReminder(onboardingId: string, opts: { manual: boolean; actorId?: string | null }) {
  const o = await db.onboarding.findUnique({ where: { id: onboardingId }, include: onboardingInclude });
  if (!o || o.stage !== "INFO_REQUESTED") return false;
  const outstanding = await outstandingLabels(o.id);
  if (!outstanding.length) return false;
  const r = await getAutomation("onboarding.reminders");
  const to = clientContact(o);

  if (!opts.manual && o.remindersSent >= r.config.max!) {
    await ensureTask(o.clientId, TASK_KEYS.chase, { title: `Call ${o.client.name}: information still outstanding`, description: `${o.remindersSent} reminders sent. Still waiting for:\n${outstanding.map((l) => `- ${l}`).join("\n")}`, assigneeId: o.ownerId, priority: "HIGH" });
    await logOnboarding(o.id, "Reminders exhausted. Task created to call the client.");
    return false;
  }
  if (!to.email) {
    await logOnboarding(o.id, "Reminder not sent: no email address for this client.");
    return false;
  }
  const owner = o.ownerId ? await db.user.findUnique({ where: { id: o.ownerId } }) : null;
  const sender = opts.actorId ?? o.ownerId;
  const mail = onboardingReminderEmail({ contactName: to.name, senderName: owner?.name ?? "Outset", outstanding, uploadUrl: uploadUrl(o.uploadToken), final: !opts.manual && o.remindersSent + 1 >= r.config.max! });
  await queueEmail({ to: to.email, ...mail, senderId: sender });
  await db.onboarding.update({ where: { id: o.id }, data: { remindersSent: { increment: 1 }, lastReminderAt: new Date() } });
  await logOnboarding(o.id, `${opts.manual ? "Reminder sent" : "Automatic reminder sent"} to ${to.email} (${outstanding.length} item${outstanding.length === 1 ? "" : "s"} outstanding).`, { actorId: opts.actorId });
  return true;
}

/** Scheduled job: remind, then schedule the next reminder. */
export async function reminderJob(onboardingId: string) {
  const r = await getAutomation("onboarding.reminders");
  if (!r.enabled) return;
  const sent = await sendReminder(onboardingId, { manual: false });
  if (sent) await enqueue("onboarding.reminder", { onboardingId }, new Date(Date.now() + r.config.days! * 86_400_000));
}
