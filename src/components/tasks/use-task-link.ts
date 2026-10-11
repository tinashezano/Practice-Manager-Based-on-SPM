"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** Builds URLs that keep the current filters/view and change only some params. */
export function useParamLink() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();

  const hrefWith = useCallback(
    (changes: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [params, pathname],
  );

  const go = useCallback((changes: Record<string, string | null | undefined>) => router.push(hrefWith(changes), { scroll: false }), [router, hrefWith]);

  return { hrefWith, go, params };
}
