"use client";

import { useActionState } from "react";
import { Button, inputClass } from "@/components/ui";
import type { PublicState } from "./actions";

export function AcceptForm({ action, contactName }: { action: (s: PublicState, fd: FormData) => Promise<PublicState>; contactName: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-sm font-medium">
        Type your full name to sign
        <input name="name" required defaultValue="" placeholder={contactName} className={`${inputClass} mt-1 font-medium`} />
      </label>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" name="agree" required className="mt-0.5" />
        I have read this proposal and its terms, I accept them on behalf of the business named above, and I&apos;m authorised to do so. I agree that typing my name is my electronic signature.
      </label>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button disabled={pending}>{pending ? "Signing…" : "Accept and sign"}</Button>
    </form>
  );
}

export function PayForm({ action, label }: { action: (s: PublicState) => Promise<PublicState>; label: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-2">
      <Button disabled={pending} className="w-full sm:w-auto">{pending ? "Opening secure checkout…" : label}</Button>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
