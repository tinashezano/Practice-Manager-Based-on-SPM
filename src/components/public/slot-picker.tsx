"use client";

import clsx from "clsx";
import { useActionState, useState } from "react";
import { Button, inputClass } from "@/components/ui";
import type { BookState } from "@/app/book/actions";

const fmtDay = (d: string) => new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00Z`));
const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

/**
 * Pick a day, then a time. In "book" mode it then asks for contact details;
 * in "reschedule" mode it submits the new time straight away.
 */
export function SlotPicker({
  slots,
  action,
  mode,
}: {
  slots: Record<string, string[]>;
  action: (state: BookState, fd: FormData) => Promise<BookState>;
  mode: "book" | "reschedule";
}) {
  const days = Object.keys(slots);
  const [day, setDay] = useState(days[0] ?? "");
  const [start, setStart] = useState("");
  const [state, formAction, pending] = useActionState(action, {});

  if (!days.length) return <p className="py-8 text-center text-sm text-muted">No times are available right now. Please email us and we&apos;ll find a time.</p>;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="start" value={start} />
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">1. Choose a day</div>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <button type="button" key={d} onClick={() => { setDay(d); setStart(""); }} className={clsx("rounded-lg border px-3 py-2 text-sm", d === day ? "border-brand bg-brand-soft font-medium text-brand" : "border-border hover:border-brand")}>
              {fmtDay(d)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">2. Choose a time (South African time)</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(slots[day] ?? []).map((s) => (
            <button type="button" key={s} onClick={() => setStart(s)} className={clsx("rounded-lg border px-2 py-2 text-sm", s === start ? "border-brand bg-brand text-white" : "border-border hover:border-brand")}>
              {fmtTime(s)}
            </button>
          ))}
        </div>
      </div>

      {mode === "book" && start && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">3. Your details</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="name" required placeholder="Full name *" className={inputClass} />
            <input name="email" type="email" required placeholder="Email *" className={inputClass} />
            <input name="phone" placeholder="Phone" className={inputClass} />
            <input name="company" placeholder="Business name" className={inputClass} />
          </div>
          <textarea name="message" rows={3} placeholder="What would you like help with?" className={inputClass} />
          <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <label className="flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" name="consent" required className="mt-0.5" />
            I agree that Outset may store and use my details to arrange this call and contact me about its services, in line with POPIA.
          </label>
        </div>
      )}

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button disabled={!start || pending} className="w-full sm:w-auto">
        {pending ? "Booking…" : mode === "book" ? (start ? `Confirm ${fmtDay(day)} at ${fmtTime(start)}` : "Choose a time") : start ? `Move to ${fmtDay(day)} at ${fmtTime(start)}` : "Choose a new time"}
      </Button>
    </form>
  );
}
