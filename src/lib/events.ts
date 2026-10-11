import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type EventType =
  | "user.invited"
  | "user.updated"
  | "lead.created"
  | "booking.confirmed"
  | "discovery.completed"
  | "proposal.sent"
  | "proposal.signed"
  | "payment.succeeded"
  | "client.created"
  | "onboarding.stageChanged";

/**
 * Record a domain event. Automations consume these from the EventLog.
 * Passing an idempotencyKey (e.g. a webhook delivery id) makes repeat calls a
 * no-op, so retried webhooks can't trigger an automation twice.
 */
export async function emitEvent(
  type: EventType,
  payload: Prisma.InputJsonValue,
  opts: { actorId?: string; idempotencyKey?: string } = {},
) {
  if (opts.idempotencyKey) {
    return db.eventLog.upsert({
      where: { idempotencyKey: opts.idempotencyKey },
      create: { type, payload, ...opts },
      update: {},
    });
  }
  return db.eventLog.create({ data: { type, payload, actorId: opts.actorId } });
}
