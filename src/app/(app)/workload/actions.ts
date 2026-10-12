"use server";

import { LeaveType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

type Result = { ok: true } | { ok: false; error: string };

const schema = z.object({
  userId: z.string().min(1),
  type: z.nativeEnum(LeaveType),
  startDate: z.string(),
  endDate: z.string(),
  halfDay: z.boolean(),
  note: z.string().trim().max(300).nullable(),
});

export async function addLeave(input: z.input<typeof schema>): Promise<Result> {
  const actor = await requirePermission("tasks.work");
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]!.message };
  if (p.data.userId !== actor.id && !can(actor.role, "team.manage")) return { ok: false, error: "You can only add your own leave" };
  const start = parseISODate(p.data.startDate);
  const end = parseISODate(p.data.endDate);
  if (!start || !end) return { ok: false, error: "Choose the dates" };
  if (end < start) return { ok: false, error: "The end date is before the start date" };
  if (p.data.halfDay && start.getTime() !== end.getTime()) return { ok: false, error: "A half day must start and end on the same date" };
  await db.leave.create({ data: { userId: p.data.userId, type: p.data.type, startDate: start, endDate: end, halfDay: p.data.halfDay, note: p.data.note || null, createdById: actor.id } });
  revalidatePath("/workload");
  return { ok: true };
}

export async function deleteLeave(id: string): Promise<Result> {
  const actor = await requirePermission("tasks.work");
  const l = await db.leave.findUnique({ where: { id } });
  if (!l) return { ok: false, error: "Not found" };
  if (l.userId !== actor.id && !can(actor.role, "team.manage")) return { ok: false, error: "You can only remove your own leave" };
  await db.leave.delete({ where: { id } });
  revalidatePath("/workload");
  return { ok: true };
}
