"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export type FormState = { error?: string; ok?: string };

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const opt = z.preprocess(blank, z.string().trim().max(10_000).nullable());

const schema = z.object({
  legalName: z.string().trim().min(2, "Enter the firm's name").max(200),
  registrationNumber: opt,
  vatNumber: opt,
  vatRegistered: z.boolean(),
  vatRatePercent: z.coerce.number().int().min(0).max(30),
  email: z.preprocess(blank, z.string().trim().email("Enter a valid email").nullable()),
  phone: opt,
  address: opt,
  proposalValidityDays: z.coerce.number().int().min(1).max(180),
  proposalTerms: opt,
  welcomeMessage: opt,
});

export async function saveFirmSettings(_: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("settings.manage");
  const parsed = schema.safeParse({ ...Object.fromEntries(fd), vatRegistered: fd.get("vatRegistered") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  await db.firmSettings.upsert({ where: { id: "firm" }, create: { id: "firm", ...parsed.data }, update: parsed.data });
  revalidatePath("/settings/billing");
  return { ok: "Saved. New proposals use these settings." };
}

/** Forget the saved proposal template: new proposals go back to the built-in layout and the terms above. */
export async function resetProposalTemplate() {
  await requirePermission("settings.manage");
  await db.firmSettings.update({ where: { id: "firm" }, data: { proposalTemplate: Prisma.DbNull } });
  revalidatePath("/settings/billing");
}
