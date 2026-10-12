"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Deal } from "@prisma/client";
import { Button, Card, inputClass } from "@/components/ui";
import { SOURCE_LABELS, STAGE_META } from "@/lib/deal-meta";
import { toISODate } from "@/lib/dates";
import { ENTITY_LABELS } from "@/lib/task-meta";
import { saveDeal, type FormState } from "./actions";

function L({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block text-xs font-medium text-muted ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function DealForm({ deal, staff, currentUserId }: { deal?: Deal; staff: { id: string; name: string }[]; currentUserId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveDeal.bind(null, deal?.id ?? null), {});
  return (
    <form action={action}>
      <Card className="grid gap-4 sm:grid-cols-2">
        <L label="Business or person *" wide><input name="name" required defaultValue={deal?.name} placeholder="e.g. Khumalo Logistics" className={inputClass} /></L>
        <L label="Contact person *"><input name="contactName" required defaultValue={deal?.contactName} className={inputClass} /></L>
        <L label="Entity type">
          <select name="entityType" defaultValue={deal?.entityType ?? ""} className={inputClass}>
            <option value="">Not sure yet</option>
            {Object.entries(ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </L>
        <L label="Email"><input name="email" type="email" defaultValue={deal?.email ?? ""} className={inputClass} /></L>
        <L label="Phone"><input name="phone" defaultValue={deal?.phone ?? ""} className={inputClass} /></L>
        <L label="Services they're interested in" wide><input name="servicesInterest" defaultValue={deal?.servicesInterest ?? ""} placeholder="e.g. Monthly bookkeeping, VAT, payroll" className={inputClass} /></L>
        <L label="Estimated value (R)"><input name="value" type="number" min={0} step={100} defaultValue={deal ? deal.valueCents / 100 : ""} className={inputClass} /></L>
        <L label={`Win probability % (blank = stage default${deal ? `, ${STAGE_META[deal.stage].probability}%` : ""})`}>
          <input name="probability" type="number" min={0} max={100} defaultValue={deal?.probability ?? ""} className={inputClass} />
        </L>
        <L label="Expected close"><input name="expectedCloseDate" type="date" defaultValue={toISODate(deal?.expectedCloseDate)} className={inputClass} /></L>
        <L label="Owner">
          <select name="ownerId" defaultValue={deal?.ownerId ?? currentUserId} className={inputClass}>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </L>
        <L label="Source">
          <select name="source" defaultValue={deal?.source ?? "MANUAL"} className={inputClass}>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </L>
        <L label="Notes" wide><textarea name="notes" rows={3} defaultValue={deal?.notes ?? ""} className={inputClass} /></L>
        {!deal && <p className="text-xs text-muted sm:col-span-2">Saving a new lead with an email sends them the default booking link automatically (see Settings → Automations).</p>}
        {state.error && <p className="text-sm text-danger sm:col-span-2">{state.error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Link href={deal ? `/deals/${deal.id}` : "/deals/pipeline"}><Button type="button" variant="secondary">Cancel</Button></Link>
          <Button disabled={pending}>{pending ? "Saving…" : deal ? "Save changes" : "Create lead"}</Button>
        </div>
      </Card>
    </form>
  );
}
