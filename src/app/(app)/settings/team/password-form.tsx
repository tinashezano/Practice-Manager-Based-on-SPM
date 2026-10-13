"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, inputBase } from "@/components/ui";
import { setStaffPassword, type ActionState } from "./actions";

export function StaffPasswordForm({ userId, hasPassword }: { userId: string; hasPassword: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setStaffPassword, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder={hasPassword ? "New password" : "Set a password"}
        aria-label="Password"
        className={`${inputBase} w-40`}
      />
      <Button variant="secondary" disabled={pending}>{hasPassword ? "Reset" : "Set"}</Button>
      {(state.error || state.ok) && (
        <span className={`text-xs ${state.error ? "text-danger" : "text-success"}`}>{state.error ?? state.ok}</span>
      )}
    </form>
  );
}
