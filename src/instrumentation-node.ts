import { startWorker } from "@/lib/jobs";

if (process.env.WORKER_ENABLED !== "false") {
  startWorker(Number(process.env.WORKER_INTERVAL_MS ?? 10_000));
}
