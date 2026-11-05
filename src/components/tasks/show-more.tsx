"use client";

import Link from "next/link";
import { useParamLink } from "./use-task-link";

/** "Showing 200 of 1 340 · Show 200 more" under long task views. */
export function ShowMore({ shown, total, limit, step = 200, max = 1000 }: { shown: number; total: number; limit: number; step?: number; max?: number }) {
  const { hrefWith } = useParamLink();
  if (shown >= total) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-3 text-sm text-muted">
      <span>Showing {shown} of {total} tasks.</span>
      {limit < max ? (
        <Link href={hrefWith({ limit: String(Math.min(max, limit + step)) })} scroll={false} className="font-medium text-brand hover:underline">
          Show {Math.min(step, total - shown)} more
        </Link>
      ) : (
        <span>Use the filters or search to narrow it down.</span>
      )}
    </div>
  );
}
