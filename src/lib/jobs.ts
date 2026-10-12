import type { Job, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * A small job queue stored in Postgres. Jobs are claimed with
 * FOR UPDATE SKIP LOCKED, so several app instances can safely share it.
 * Failed jobs retry with backoff, up to MAX_ATTEMPTS.
 */
const MAX_ATTEMPTS = 5;
const STALE_LOCK = "5 minutes";

export async function enqueue(name: string, payload: Prisma.InputJsonValue, runAt?: Date) {
  return db.job.create({ data: { name, payload, runAt: runAt ?? new Date() } });
}

async function claim(limit: number, onlyId?: string): Promise<Job[]> {
  return db.$queryRaw<Job[]>`
    UPDATE "Job" SET "lockedAt" = now(), "attempts" = "attempts" + 1
    WHERE id IN (
      SELECT id FROM "Job"
      WHERE "doneAt" IS NULL
        AND "runAt" <= now()
        AND "attempts" < ${MAX_ATTEMPTS}
        AND ("lockedAt" IS NULL OR "lockedAt" < now() - ${STALE_LOCK}::interval)
        AND (${onlyId ?? null}::text IS NULL OR id = ${onlyId ?? null})
      ORDER BY "runAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

async function execute(job: Job) {
  const { runJob } = await import("@/lib/automations/handlers");
  try {
    await runJob(job.name, job.payload as Record<string, unknown>);
    await db.job.update({ where: { id: job.id }, data: { doneAt: new Date(), lockedAt: null, lastError: null } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[jobs] ${job.name} ${job.id} failed (attempt ${job.attempts}):`, message);
    const backoffSeconds = 30 * 2 ** (job.attempts - 1);
    await db.job.update({
      where: { id: job.id },
      data: { lockedAt: null, lastError: message.slice(0, 2000), runAt: new Date(Date.now() + backoffSeconds * 1000) },
    });
  }
}

/** Runs every due job (oldest first). Returns how many ran. */
export async function runDueJobs(limit = 20) {
  const jobs = await claim(limit);
  for (const job of jobs) await execute(job);
  return jobs.length;
}

/** Runs one specific job right now if it's due — used to process events inline. */
export async function runJobNow(id: string) {
  const [job] = await claim(1, id);
  if (job) await execute(job);
}

const globalForWorker = globalThis as unknown as { outsetWorker?: NodeJS.Timeout };

/** Polls for due jobs in the background (started from instrumentation.ts). */
export function startWorker(intervalMs = 10_000) {
  if (globalForWorker.outsetWorker) return;
  let running = false;
  globalForWorker.outsetWorker = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      while ((await runDueJobs()) > 0) {}
    } catch (err) {
      console.error("[jobs] worker tick failed:", err);
    } finally {
      running = false;
    }
  }, intervalMs);
  console.log(`[jobs] worker started (every ${intervalMs / 1000}s)`);
}
