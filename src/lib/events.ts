import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enqueue, runJobNow } from "@/lib/jobs";

export type EventType =
  | "user.invited"
  | "user.updated"
  | "lead.created"
  | "deal.stageChanged"
  | "booking.confirmed"
  | "booking.rescheduled"
  | "booking.cancelled"
  | "task.completed"
  | "proposal.sent"
  | "proposal.signed"
  | "payment.succeeded"
  | "client.created"
  | "onboarding.stageChanged";

/**
 * Records a domain event and runs its automations.
 *
 * The event is stored and queued first, then processed straight away so the
 * user sees the result on their next page load. If processing fails, the
 * worker retries it later. Passing an idempotencyKey (e.g. a webhook delivery
 * id) makes repeat calls a no-op.
 */
export async function emitEvent(
  type: EventType,
  payload: Prisma.InputJsonValue,
  opts: { actorId?: string; idempotencyKey?: string } = {},
) {
  if (opts.idempotencyKey) {
    const existing = await db.eventLog.findUnique({ where: { idempotencyKey: opts.idempotencyKey } });
    if (existing) return existing;
  }
  const event = await db.eventLog.create({ data: { type, payload, actorId: opts.actorId, idempotencyKey: opts.idempotencyKey } });
  const job = await enqueue("event", { eventId: event.id });
  try {
    await runJobNow(job.id);
  } catch (err) {
    console.error(`[events] inline processing of ${type} failed; the worker will retry`, err);
  }
  return event;
}
