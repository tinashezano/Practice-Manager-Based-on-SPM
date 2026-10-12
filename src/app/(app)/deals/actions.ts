"use server";

import { DealStage, EntityType, LeadSource } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { bookingUrl } from "@/lib/booking";
import { parseISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { changeDealStage, convertDealToClient, createDeal, logActivity } from "@/lib/deals";
import { bookingInviteEmail, queueEmail } from "@/lib/email";
import { runDueJobs } from "@/lib/jobs";
import { requirePermission } from "@/lib/session";

type Result = { ok: true } | { ok: false; error: string };
export type FormState = { error?: string };

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const opt = z.preprocess(blank, z.string().trim().max(2000).nullable().optional());

const dealSchema = z.object({
  name: z.string().trim().min(2, "Enter the business or person's name").max(200),
  contactName: z.string().trim().min(2, "Enter the contact person").max(200),
  email: z.preprocess(blank, z.string().trim().email("Enter a valid email").nullable().optional()),
  phone: opt,
  entityType: z.preprocess(blank, z.nativeEnum(EntityType).nullable().optional()),
  servicesInterest: opt,
  notes: opt,
  source: z.nativeEnum(LeadSource).default("MANUAL"),
  value: z.preprocess(blank, z.coerce.number().min(0).max(100_000_000).nullable().optional()),
  probability: z.preprocess(blank, z.coerce.number().int().min(0).max(100).nullable().optional()),
  expectedCloseDate: z.preprocess(blank, z.string().nullable().optional()),
  ownerId: z.preprocess(blank, z.string().nullable().optional()),
});

export async function saveDeal(dealId: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("deals.manage");
  const parsed = dealSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { value, probability, expectedCloseDate, ...rest } = parsed.data;
  const valueCents = Math.round((value ?? 0) * 100);

  let id = dealId;
  if (id) {
    await db.deal.update({
      where: { id },
      data: { ...rest, email: rest.email?.toLowerCase() ?? null, valueCents, probability: probability ?? null, expectedCloseDate: parseISODate(expectedCloseDate) },
    });
    await logActivity(id, "SYSTEM", "Details updated.", actor.id);
  } else {
    const deal = await createDeal({ ...rest, valueCents, ownerId: rest.ownerId ?? actor.id }, actor.id);
    if (probability != null || expectedCloseDate) {
      await db.deal.update({ where: { id: deal.id }, data: { probability: probability ?? null, expectedCloseDate: parseISODate(expectedCloseDate) } });
    }
    id = deal.id;
  }
  revalidatePath("/", "layout");
  redirect(`/deals/${id}`);
}

export async function moveDeal(dealId: string, stage: DealStage, lostReason?: string): Promise<Result> {
  const actor = await requirePermission("deals.manage");
  if (stage === "WON") {
    return { ok: false, error: "Won happens when the client is converted. Open the deal and use “Convert to client”." };
  }
  if (stage === "LOST" && !lostReason?.trim()) return { ok: false, error: "Give a reason the deal was lost" };
  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return { ok: false, error: "Deal not found" };
  if (deal.stage === "WON") return { ok: false, error: "This deal is already won and converted to a client." };
  await changeDealStage(dealId, stage, { actorId: actor.id, lostReason: lostReason?.trim() });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addNote(dealId: string, body: string): Promise<Result> {
  const actor = await requirePermission("deals.manage");
  const text = body.trim();
  if (!text) return { ok: false, error: "Write a note first" };
  await logActivity(dealId, "NOTE", text.slice(0, 5000), actor.id);
  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}

export async function sendBookingLink(dealId: string, linkId: string): Promise<Result> {
  const actor = await requirePermission("deals.manage");
  const [deal, link] = await Promise.all([db.deal.findUnique({ where: { id: dealId } }), db.bookingLink.findUnique({ where: { id: linkId } })]);
  if (!deal?.email) return { ok: false, error: "This lead has no email address" };
  if (!link?.active) return { ok: false, error: "Choose an active booking link" };
  const mail = bookingInviteEmail({ contactName: deal.contactName, senderName: actor.name, linkTitle: link.title, url: bookingUrl(link.slug) });
  await queueEmail({ to: deal.email, ...mail, senderId: actor.id, dealId });
  await logActivity(dealId, "SYSTEM", `${actor.name} sent the ${link.title} booking link.`, actor.id);
  await runDueJobs(); // send now rather than on the next worker tick
  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}

export async function convertToClient(dealId: string): Promise<Result> {
  const actor = await requirePermission("clients.manage");
  const clientId = await convertDealToClient(dealId, actor.id);
  revalidatePath("/", "layout");
  redirect(`/clients/${clientId}`);
}

export async function deleteDeal(dealId: string): Promise<Result> {
  await requirePermission("settings.manage");
  await db.deal.delete({ where: { id: dealId } });
  revalidatePath("/", "layout");
  redirect("/deals");
}
