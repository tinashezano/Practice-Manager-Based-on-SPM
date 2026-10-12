"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export type FormState = { error?: string; ok?: string };

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM times");

const schema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(2, "Give the link a title").max(100),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "The link address can only use letters, numbers and dashes"),
    description: z.string().trim().max(1000).optional(),
    hostId: z.string().min(1),
    durationMinutes: z.coerce.number().int().min(10).max(240),
    bufferMinutes: z.coerce.number().int().min(0).max(120),
    minNoticeHours: z.coerce.number().int().min(0).max(24 * 14),
    maxDaysAhead: z.coerce.number().int().min(1).max(90),
    startTime: time,
    endTime: time,
    days: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Pick at least one day"),
    isDefault: z.boolean(),
    active: z.boolean(),
  })
  .refine((v) => v.startTime < v.endTime, { message: "End time must be after start time" });

export async function saveBookingLink(_: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("deals.manage");
  const parsed = schema.safeParse({
    ...Object.fromEntries(fd),
    id: (fd.get("id") as string) || undefined,
    days: fd.getAll("days"),
    isDefault: fd.get("isDefault") === "on",
    active: fd.get("active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { id, ...data } = parsed.data;

  const clash = await db.bookingLink.findUnique({ where: { slug: data.slug } });
  if (clash && clash.id !== id) return { error: "That link address is already used" };

  await db.$transaction(async (tx) => {
    if (data.isDefault) await tx.bookingLink.updateMany({ where: { hostId: data.hostId }, data: { isDefault: false } });
    if (id) await tx.bookingLink.update({ where: { id }, data });
    else await tx.bookingLink.create({ data });
  });
  revalidatePath("/deals/booking");
  return { ok: id ? "Saved." : "Booking link created." };
}
