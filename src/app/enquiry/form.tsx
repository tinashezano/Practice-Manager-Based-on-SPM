"use client";

import { useActionState } from "react";
import { Button, inputClass } from "@/components/ui";
import { submitEnquiry, type EnquiryState } from "./actions";

const SERVICES = ["Bookkeeping", "VAT returns", "Payroll (EMP201)", "Annual financial statements", "Income tax", "Company registration (CIPC)", "Advisory / CFO services"];

export function EnquiryForm({ embed }: { embed: boolean }) {
  const [state, action, pending] = useActionState<EnquiryState, FormData>(submitEnquiry.bind(null, embed), {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Full name *" className={inputClass} />
        <input name="email" type="email" required placeholder="Email *" className={inputClass} />
        <input name="phone" placeholder="Phone" className={inputClass} />
        <input name="company" placeholder="Business name" className={inputClass} />
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">What can we help with?</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {SERVICES.map((s) => (
            <label key={s} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <input type="checkbox" name="services" value={s} /> {s}
            </label>
          ))}
        </div>
      </div>
      <textarea name="message" rows={4} placeholder="Tell us a bit about your business" className={inputClass} />
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" name="consent" required className="mt-0.5" />
        I agree that Outset may store and use my details to respond to this enquiry and contact me about its services, in line with POPIA.
      </label>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button disabled={pending}>{pending ? "Sending…" : "Send enquiry"}</Button>
    </form>
  );
}
