"use server";

import { OnboardingStage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { logOnboarding, outstandingLabels, reviewItem, sendReminder, setStage, startOnboarding, toggleSetupItem, uploadUrl } from "@/lib/onboarding";
import { welcomePackEmail, queueEmail } from "@/lib/email";
import { DEFAULT_WELCOME, getFirmSettings } from "@/lib/firm";
import { runDueJobs } from "@/lib/jobs";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

type Result = { ok: true } | { ok: false; error: string };

async function wrap(clientId: string, fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath(`/clients/${clientId}/onboarding`);
  revalidatePath("/clients/onboarding");
  return { ok: true };
}

async function itemClient(itemId: string) {
  const item = await db.onboardingItem.findUniqueOrThrow({ where: { id: itemId }, include: { onboarding: { select: { clientId: true } } } });
  return item.onboarding.clientId;
}

export async function decideItem(itemId: string, decision: "ACCEPTED" | "REJECTED" | "NOT_APPLICABLE" | "PENDING", note?: string): Promise<Result> {
  const actor = await requirePermission("clients.view");
  return wrap(await itemClient(itemId), () => reviewItem(itemId, decision, note ?? null, actor));
}

export async function setSetupItem(itemId: string, isDone: boolean): Promise<Result> {
  const actor = await requirePermission("clients.view");
  return wrap(await itemClient(itemId), () => toggleSetupItem(itemId, isDone, actor.id));
}

const addSchema = z.object({
  onboardingId: z.string(),
  kind: z.enum(["INFO", "SETUP"]),
  label: z.string().trim().min(2, "Describe the item").max(200),
  description: z.string().trim().max(500).optional(),
  required: z.boolean(),
  allowsText: z.boolean(),
});

export async function addItem(input: z.input<typeof addSchema>): Promise<Result> {
  const actor = await requirePermission("clients.manage");
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const o = await db.onboarding.findUniqueOrThrow({ where: { id: parsed.data.onboardingId } });
  return wrap(o.clientId, async () => {
    const position = await db.onboardingItem.count({ where: { onboardingId: o.id } });
    await db.onboardingItem.create({ data: { ...parsed.data, description: parsed.data.description || null, position } });
    await logOnboarding(o.id, `Added ${parsed.data.kind === "INFO" ? "client item" : "setup step"}: ${parsed.data.label}.`, { actorId: actor.id });
    // A new required client item reopens "Information requested".
    if (parsed.data.kind === "INFO" && parsed.data.required && (o.stage === "INFO_RECEIVED" || o.stage === "SETUP")) {
      await setStage(o.id, "INFO_REQUESTED", actor.id, "New information requested from the client.");
    }
  });
}

export async function removeItem(itemId: string): Promise<Result> {
  const actor = await requirePermission("clients.manage");
  const item = await db.onboardingItem.findUniqueOrThrow({ where: { id: itemId }, include: { onboarding: true, _count: { select: { files: true } } } });
  if (item._count.files) return { ok: false, error: "This item has files from the client. Mark it not applicable instead." };
  return wrap(item.onboarding.clientId, async () => {
    await db.onboardingItem.delete({ where: { id: itemId } });
    await logOnboarding(item.onboardingId, `Removed: ${item.label}.`, { actorId: actor.id });
  });
}

export async function remindNow(onboardingId: string): Promise<Result> {
  const actor = await requirePermission("clients.view");
  const o = await db.onboarding.findUniqueOrThrow({ where: { id: onboardingId } });
  return wrap(o.clientId, async () => {
    if (!(await sendReminder(onboardingId, { manual: true, actorId: actor.id }))) throw new Error("Nothing to remind about, or the client has no email address.");
    await runDueJobs();
  });
}

export async function moveStage(onboardingId: string, stage: OnboardingStage): Promise<Result> {
  const actor = await requirePermission("clients.manage");
  const o = await db.onboarding.findUniqueOrThrow({ where: { id: onboardingId } });
  if (stage === "COMPLETE" && o.reviewerId !== actor.id && !can(actor.role, "settings.manage")) {
    return { ok: false, error: "Only the reviewer or a Director can complete onboarding." };
  }
  return wrap(o.clientId, () => setStage(onboardingId, stage, actor.id, "Moved manually."));
}

export async function approve(onboardingId: string): Promise<Result> {
  return moveStage(onboardingId, "COMPLETE");
}

export async function setPeople(onboardingId: string, field: "ownerId" | "reviewerId", userId: string): Promise<Result> {
  await requirePermission("clients.manage");
  const o = await db.onboarding.update({ where: { id: onboardingId }, data: { [field]: userId || null } });
  return wrap(o.clientId, async () => {});
}

/** For clients added by hand (not through a proposal): start onboarding and email the welcome pack. */
export async function startManualOnboarding(clientId: string): Promise<Result> {
  const actor = await requirePermission("clients.manage");
  return wrap(clientId, async () => {
    const client = await db.client.findUniqueOrThrow({ where: { id: clientId }, include: { projects: true, contacts: { orderBy: { isPrimary: "desc" } } } });
    const o = await startOnboarding(clientId, { ownerId: client.ownerId ?? actor.id, actorId: actor.id, services: client.projects.map((p) => p.name) });
    const to = client.contacts.find((c) => c.email) ?? null;
    const email = to?.email ?? client.email;
    if (!email) throw new Error("Onboarding started, but add a contact email to send the welcome pack.");
    const firm = await getFirmSettings();
    const owner = await db.user.findUnique({ where: { id: client.ownerId ?? actor.id } });
    await queueEmail({
      to: email,
      ...welcomePackEmail({
        contactName: to?.name ?? client.name,
        senderName: owner?.name ?? actor.name,
        message: firm.welcomeMessage || DEFAULT_WELCOME,
        services: client.projects.map((p) => p.name),
        ownerName: owner?.name ?? actor.name,
        needed: await outstandingLabels(o.id),
        uploadUrl: uploadUrl(o.uploadToken),
      }),
      senderId: owner?.id ?? actor.id,
    });
    await runDueJobs();
  });
}
