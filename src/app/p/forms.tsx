"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import type { PublicState } from "./actions";

export function PayForm({ action, label }: { action: (s: PublicState) => Promise<PublicState>; label: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-2">
      <Button disabled={pending} className="w-full sm:w-auto">{pending ? "Opening secure checkout…" : label}</Button>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
