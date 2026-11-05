import Link from "next/link";

/** Reads a "?limit=" page size: `fallback` by default, capped at `max`. */
export function pageLimit(param: string | undefined, fallback = 100, max = 2000) {
  const n = Number(param);
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.floor(n)) : fallback;
}

/** "Showing 100 of 412 · Show 100 more" under long lists (server-rendered). */
export function ListMore({ shown, total, limit, path, params, noun, step = 100 }: {
  shown: number;
  total: number;
  limit: number;
  path: string;
  params: Record<string, string | undefined>;
  noun: string;
  step?: number;
}) {
  if (shown >= total) return null;
  const next = new URLSearchParams(Object.entries({ ...params, limit: String(limit + step) }).filter((e): e is [string, string] => !!e[1]));
  return (
    <div className="mt-3 flex items-center justify-center gap-3 text-sm text-muted">
      <span>Showing {shown} of {total} {noun}.</span>
      <Link href={`${path}?${next}`} scroll={false} className="font-medium text-brand hover:underline">Show {Math.min(step, total - shown)} more</Link>
    </div>
  );
}
