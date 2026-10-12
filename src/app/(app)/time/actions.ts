"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { logTime, startTimer, stopTimer } from "@/lib/time";
import { parseDuration } from "@/lib/time-format";

type Result = { ok: true } | { ok: false; error: string };

export async function startTimerAction(taskId: string | null, description?: string): Promise<Result> {
  const user = await requirePermission("tasks.work");
  if (taskId && !(await db.task.findUnique({ where: { id: taskId } }))) return { ok: false, error: "Task not found" };
  await startTimer(user.id, taskId, description);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function stopTimerAction(): Promise<Result> {
  const user = await requirePermission("tasks.work");
  await stopTimer(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

const entrySchema = z.object({
  taskId: z.string().min(1).nullable(),
  clientId: z.string().min(1).nullable(),
  date: z.string(),
  duration: z.string(),
  billable: z.boolean().optional(),
  description: z.string().trim().max(500).nullable(),
  userId: z.string().optional(),
});

export async function logTimeAction(input: z.input<typeof entrySchema>): Promise<Result> {
  const actor = await requirePermission("tasks.work");
  const p = entrySchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]!.message };
  const minutes = parseDuration(p.data.duration);
  if (!minutes) return { ok: false, error: "Enter time like 1h30, 1.5 or 45m" };
  if (minutes > 16 * 60) return { ok: false, error: "That's more than 16 hours in one entry" };
  if (!parseISODate(p.data.date)) return { ok: false, error: "Choose a date" };
  if (!p.data.taskId && !p.data.clientId) return { ok: false, error: "Choose a task or a client" };
  const userId = p.data.userId && p.data.userId !== actor.id && can(actor.role, "tasks.manageAll") ? p.data.userId : actor.id;
  await logTime({ userId, taskId: p.data.taskId, clientId: p.data.clientId, date: p.data.date, minutes, billable: p.data.billable, description: p.data.description || null });
  revalidatePath("/", "layout");
  return { ok: true };
}

async function editableEntry(id: string) {
  const actor = await requirePermission("tasks.work");
  const e = await db.timeEntry.findUniqueOrThrow({ where: { id } });
  if (e.userId !== actor.id && !can(actor.role, "tasks.manageAll")) throw new Error("You can only change your own time");
  return e;
}

export async function updateEntry(id: string, patch: { duration?: string; billable?: boolean; description?: string | null; date?: string }): Promise<Result> {
  try {
    const e = await editableEntry(id);
    if (e.running) return { ok: false, error: "Stop the timer first" };
    const minutes = patch.duration !== undefined ? parseDuration(patch.duration) : undefined;
    if (patch.duration !== undefined && !minutes) return { ok: false, error: "Enter time like 1h30, 1.5 or 45m" };
    const date = patch.date !== undefined ? parseISODate(patch.date) : undefined;
    if (patch.date !== undefined && !date) return { ok: false, error: "Choose a date" };
    await db.timeEntry.update({ where: { id }, data: { minutes: minutes ?? undefined, billable: patch.billable, description: patch.description, date: date ?? undefined } });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteEntry(id: string): Promise<Result> {
  try {
    await editableEntry(id);
    await db.timeEntry.delete({ where: { id } });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
