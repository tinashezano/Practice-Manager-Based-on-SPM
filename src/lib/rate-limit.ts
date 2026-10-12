import { headers } from "next/headers";

// In-memory limiter for public forms (one app instance). Good enough to stop
// casual abuse; put Cloudflare in front if you ever need more.
const hits = new Map<string, number[]>();

export async function rateLimited(bucket: string, max: number, windowMs: number) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}
