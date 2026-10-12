import type { DealStage, EntityType, LeadSource } from "@prisma/client";
import { db } from "@/lib/db";
import { STAGE_META } from "@/lib/deal-meta";
import { emitEvent } from "@/lib/events";
import { notify } from "@/lib/notify";

export async function logActivity(dealId: string, type: "NOTE" | "STAGE_CHANGE" | "EMAIL" | "BOOKING" | "TASK" | "SYSTEM", body: string, actorId?: string | null) {
  await db.dealActivity.create({ data: { dealId, type, body, actorId: actorId ?? null } });
}

export type NewDeal = {
  name: string;
  contactName: string;
  email?: string | null;
  phone?: string | null;
  entityType?: EntityType | null;
  servicesInterest?: string | null;
  notes?: string | null;
  source: LeadSource;
  valueCents?: number;
  ownerId?: string | null;
  popiaConsent?: boolean;
};

/** Default owner for leads that arrive by themselves: the earliest-added active Director. */
async function defaultOwnerId() {
  const director = await db.user.findFirst({ where: { role: "DIRECTOR", active: true }, orderBy: { createdAt: "asc" } });
  return director?.id ?? null;
}

/** Creates the CRM record for a new lead and fires the "new lead" automations. */
export async function createDeal(input: NewDeal, actorId: string | null) {
  const { popiaConsent, ...data } = input;
  const deal = await db.deal.create({
    data: {
      ...data,
      email: data.email?.toLowerCase() ?? null,
      ownerId: data.ownerId ?? (await defaultOwnerId()),
      popiaConsentAt: popiaConsent ? new Date() : null,
    },
  });
  await logActivity(deal.id, "SYSTEM", `Lead created (${input.source.replace("_", " ").toLowerCase()}).`, actorId);
  if (!actorId) {
    await notify([deal.ownerId], "system", { title: `New lead: ${deal.name}`, body: deal.servicesInterest ?? deal.contactName, link: `/deals/${deal.id}` });
  }
  await emitEvent("lead.created", { dealId: deal.id }, { actorId: actorId ?? undefined });
  return deal;
}

/** Moves a deal to a new stage, logs it and fires the stage automations. */
export async function changeDealStage(dealId: string, stage: DealStage, opts: { actorId?: string | null; lostReason?: string | null; note?: string } = {}) {
  const before = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
  if (before.stage === stage) return before;
  const deal = await db.deal.update({
    where: { id: dealId },
    data: { stage, stageChangedAt: new Date(), lostReason: stage === "LOST" ? (opts.lostReason ?? before.lostReason) : null },
  });
  const reason = stage === "LOST" && opts.lostReason ? ` Reason: ${opts.lostReason}` : "";
  await logActivity(dealId, "STAGE_CHANGE", `${STAGE_META[before.stage].label} → ${STAGE_META[stage].label}.${reason}${opts.note ? ` ${opts.note}` : ""}`, opts.actorId);
  await emitEvent("deal.stageChanged", { dealId, from: before.stage, to: stage }, { actorId: opts.actorId ?? undefined });
  return deal;
}

/**
 * Turns a won deal into a client: creates the client and primary contact,
 * and moves the lead's tasks under the new client. Safe to call twice.
 */
export async function convertDealToClient(dealId: string, actorId: string | null) {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
  if (deal.clientId) return deal.clientId;

  const client = await db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: deal.name,
        entityType: deal.entityType ?? "PRIVATE_COMPANY",
        status: "ONBOARDING",
        email: deal.email,
        phone: deal.phone,
        notes: [deal.servicesInterest && `Services: ${deal.servicesInterest}`, deal.notes].filter(Boolean).join("\n\n") || null,
        ownerId: deal.ownerId,
        contacts: { create: { name: deal.contactName, email: deal.email, phone: deal.phone, isPrimary: true } },
      },
    });
    await tx.deal.update({ where: { id: dealId }, data: { clientId: client.id } });
    await tx.task.updateMany({ where: { dealId }, data: { clientId: client.id } });
    return client;
  });

  await logActivity(dealId, "SYSTEM", `Converted to client ${client.name}.`, actorId);
  if (deal.stage !== "WON") await changeDealStage(dealId, "WON", { actorId });
  await emitEvent("client.created", { clientId: client.id, dealId, source: "deal" }, { actorId: actorId ?? undefined });
  await notify([deal.ownerId], actorId ?? "system", { title: `${client.name} is now a client`, link: `/clients/${client.id}` });
  return client.id;
}
