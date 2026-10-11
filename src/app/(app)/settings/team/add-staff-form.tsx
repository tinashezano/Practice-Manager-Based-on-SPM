"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, inputClass } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/permissions";
import { addStaff, type ActionState } from "./actions";

export function AddStaffForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addStaff, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_150px_110px_auto] sm:items-end">
      <label className="text-xs font-medium text-muted">
        Name
        <input name="name" required className={`${inputClass} mt-1`} />
      </label>
      <label className="text-xs font-medium text-muted">
        Work email
        <input name="email" type="email" required className={`${inputClass} mt-1`} />
      </label>
      <label className="text-xs font-medium text-muted">
        Role
        <select name="role" defaultValue="BOOKKEEPER" className={`${inputClass} mt-1`}>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-muted">
        Hours / week
        <input name="weeklyCapacityHours" type="number" min={0} max={80} defaultValue={40} className={`${inputClass} mt-1`} />
      </label>
      <Button disabled={pending}>{pending ? "Adding…" : "Add staff"}</Button>
      {(state.error || state.ok) && (
        <p className={`text-sm sm:col-span-5 ${state.error ? "text-danger" : "text-success"}`}>{state.error ?? state.ok}</p>
      )}
    </form>
  );
}
