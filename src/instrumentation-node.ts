import { startWorker } from "@/lib/jobs";

if (process.env.WORKER_ENABLED !== "false") {
  startWorker(Number(process.env.WORKER_INTERVAL_MS ?? 10_000));
  // Make sure the daily housekeeping job is scheduled.
  import("@/lib/automations/handlers")
    .then((h) => h.scheduleNextDaily())
    .catch((err) => console.error("[jobs] couldn't schedule the daily job:", err));
}
