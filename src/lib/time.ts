import { db } from "@/lib/db";
import { firmDate } from "@/lib/availability";
import { parseISODate } from "@/lib/dates";

/** Billable by default when the work is for a real client (not internal admin or a lead). */
async function defaults(userId: string, taskId: string | null, clientId: string | null) {
  const [user, task] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { billRateCents: true, costRateCents: true } }),
    taskId ? db.task.findUnique({ where: { id: taskId }, select: { clientId: true, client: { select: { isInternal: true } } } }) : null,
  ]);
  const cid = task?.clientId ?? clientId;
  const client = task?.client ?? (cid ? await db.client.findUnique({ where: { id: cid }, select: { isInternal: true } }) : null);
  return { clientId: cid ?? null, billable: !!client && !client.isInternal, billRateCents: user.billRateCents, costRateCents: user.costRateCents };
}

export async function runningTimer(userId: string) {
  return db.timeEntry.findFirst({
    where: { userId, running: true },
    include: { task: { select: { id: true, title: true } }, client: { select: { name: true } } },
  });
}

/** Starts a timer (stopping any running one first). */
export async function startTimer(userId: string, taskId: string | null, description?: string | null) {
  await stopTimer(userId);
  // A timer without a task counts as internal admin time until it's edited.
  const internal = taskId ? null : await db.client.findFirst({ where: { isInternal: true }, select: { id: true } });
  const d = await defaults(userId, taskId, internal?.id ?? null);
  const now = new Date();
  return db.timeEntry.create({ data: { userId, taskId, ...d, date: parseISODate(firmDate(now))!, startedAt: now, running: true, description: description ?? null } });
}

/** Stops the running timer; the entry keeps at least one minute. */
export async function stopTimer(userId: string) {
  const t = await db.timeEntry.findFirst({ where: { userId, running: true } });
  if (!t || !t.startedAt) return null;
  const now = new Date();
  const minutes = Math.max(1, Math.ceil((now.getTime() - t.startedAt.getTime()) / 60_000));
  return db.timeEntry.update({ where: { id: t.id }, data: { running: false, endedAt: now, minutes } });
}

export async function logTime(p: { userId: string; taskId: string | null; clientId: string | null; date: string; minutes: number; billable?: boolean; description: string | null }) {
  const d = await defaults(p.userId, p.taskId, p.clientId);
  return db.timeEntry.create({
    data: { userId: p.userId, taskId: p.taskId, clientId: d.clientId, date: parseISODate(p.date)!, minutes: p.minutes, billable: p.billable ?? d.billable, description: p.description, billRateCents: d.billRateCents, costRateCents: d.costRateCents },
  });
}
