"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type Result = { ok: true; id?: string } | { ok: false; error: string };

/** Runs a server action in a transition and surfaces its error as a toast. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const run = useCallback((fn: () => Promise<Result>, onOk?: (r: Result & { ok: true }) => void) => {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) onOk?.(r);
      else setError(r.error);
    });
  }, []);

  const toast = error ? (
    <div role="alert" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm text-white shadow-lg">
      {error}
    </div>
  ) : null;

  return { run, pending, toast };
}
