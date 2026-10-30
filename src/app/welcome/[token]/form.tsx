"use client";

import { useActionState } from "react";
import { Button, inputClass } from "@/components/ui";
import type { WelcomeState } from "./actions";

export function SetupForm({ action, email }: { action: (s: WelcomeState, fd: FormData) => Promise<WelcomeState>; email: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="mt-6 space-y-3">
      <input type="email" value={email} readOnly autoComplete="username" className={`${inputClass} bg-background`} aria-label="Email" />
      <label className="block text-xs font-medium text-muted">
        Choose a password (at least 10 characters)
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-xs font-medium text-muted">
        Type it again
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className={`${inputClass} mt-1`} />
      </label>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button className="w-full" disabled={pending}>{pending ? "Setting up…" : "Set up my account"}</Button>
    </form>
  );
}
