"use client";

import { useActionState } from "react";
import type { FirmSettings } from "@prisma/client";
import { Button, Card, inputClass } from "@/components/ui";
import { saveFirmSettings, type FormState } from "./actions";

function L({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`block text-xs font-medium text-muted ${wide ? "sm:col-span-2" : ""}`}>{label}<div className="mt-1">{children}</div></label>;
}

export function FirmForm({ s, defaults }: { s: FirmSettings; defaults: { terms: string; welcome: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveFirmSettings, {});
  return (
    <form action={action}>
      <Card className="grid gap-4 sm:grid-cols-2">
        <L label="Firm name on proposals" wide><input name="legalName" required defaultValue={s.legalName} className={inputClass} /></L>
        <L label="Company registration number"><input name="registrationNumber" defaultValue={s.registrationNumber ?? ""} className={inputClass} /></L>
        <L label="VAT number"><input name="vatNumber" defaultValue={s.vatNumber ?? ""} className={inputClass} /></L>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="vatRegistered" defaultChecked={s.vatRegistered} /> We are VAT registered (add VAT to proposals)</label>
        <L label="VAT rate %"><input name="vatRatePercent" type="number" min={0} max={30} defaultValue={s.vatRatePercent} className={inputClass} /></L>
        <L label="Email"><input name="email" type="email" defaultValue={s.email ?? ""} className={inputClass} /></L>
        <L label="Phone"><input name="phone" defaultValue={s.phone ?? ""} className={inputClass} /></L>
        <L label="Address" wide><input name="address" defaultValue={s.address ?? ""} className={inputClass} /></L>
        <L label="Proposals valid for (days)"><input name="proposalValidityDays" type="number" min={1} max={180} defaultValue={s.proposalValidityDays} className={inputClass} /></L>
        <div />
        <L label="Default proposal terms (your engagement letter terms)" wide><textarea name="proposalTerms" rows={10} defaultValue={s.proposalTerms ?? defaults.terms} className={`${inputClass} text-xs`} /></L>
        <L label="Welcome pack message (emailed when a client signs and pays)" wide><textarea name="welcomeMessage" rows={5} defaultValue={s.welcomeMessage ?? defaults.welcome} className={inputClass} /></L>
        {(state.error || state.ok) && <p className={`text-sm sm:col-span-2 ${state.error ? "text-danger" : "text-success"}`}>{state.error ?? state.ok}</p>}
        <div className="flex justify-end sm:col-span-2"><Button disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button></div>
      </Card>
    </form>
  );
}
