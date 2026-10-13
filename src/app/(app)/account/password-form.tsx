"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, inputClass } from "@/components/ui";
import { changeOwnPassword, type ActionState } from "./actions";

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(changeOwnPassword, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="max-w-sm space-y-3">
      {hasPassword && (
        <label className="block text-xs font-medium text-muted">
          Current password
          <input name="current" type="password" required autoComplete="current-password" className={`${inputClass} mt-1`} />
        </label>
      )}
      <label className="block text-xs font-medium text-muted">
        New password (at least 10 characters)
        <input name="next" type="password" required minLength={10} autoComplete="new-password" className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-xs font-medium text-muted">
        Confirm new password
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className={`${inputClass} mt-1`} />
      </label>
      <Button disabled={pending}>{pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}</Button>
      {(state.error || state.ok) && (
        <p className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>{state.error ?? state.ok}</p>
      )}
    </form>
  );
}
