"use client";

import { Pencil, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import type { Service } from "@prisma/client";
import { Button, inputClass } from "@/components/ui";
import { saveService, type FormState } from "../actions";

function Form({ service, templates, onDone }: { service?: Service; templates: { id: string; name: string }[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (s, fd) => {
    const r = await saveService(s, fd);
    if (r.ok) onDone();
    return r;
  }, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      {service && <input type="hidden" name="id" value={service.id} />}
      <label className="text-xs font-medium text-muted sm:col-span-2">Name<input name="name" required defaultValue={service?.name} className={`${inputClass} mt-1`} /></label>
      <label className="text-xs font-medium text-muted">Billing
        <select name="billingType" defaultValue={service?.billingType ?? "MONTHLY"} className={`${inputClass} mt-1`}>
          <option value="MONTHLY">Monthly retainer</option>
          <option value="ONCE_OFF">Once-off</option>
        </select>
      </label>
      <label className="text-xs font-medium text-muted">Price excl. VAT (R)<input name="price" required defaultValue={service ? (service.priceCents / 100).toFixed(2) : ""} placeholder="2500" className={`${inputClass} mt-1`} /></label>
      <label className="text-xs font-medium text-muted sm:col-span-4">Description (shown on proposals)<textarea name="description" rows={2} defaultValue={service?.description ?? ""} className={`${inputClass} mt-1`} /></label>
      <label className="text-xs font-medium text-muted sm:col-span-2">Job template when the client signs up
        <select name="templateId" defaultValue={service?.templateId ?? ""} className={`${inputClass} mt-1`}>
          <option value="">None (blank project)</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="taxable" defaultChecked={service?.taxable ?? true} /> VAT applies</label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={service?.active ?? true} /> Active</label>
      {state.error && <p className="text-sm text-danger sm:col-span-4">{state.error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-4">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button disabled={pending}>{pending ? "Saving…" : "Save service"}</Button>
      </div>
    </form>
  );
}

export function NewService({ templates }: { templates: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}><Plus size={15} /> New service</Button>;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-20" onClick={() => setOpen(false)}>
      <div className="w-full max-w-2xl rounded-xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-base font-semibold">New service</h2>
        <Form templates={templates} onDone={() => setOpen(false)} />
      </div>
    </div>
  );
}

export function EditService({ service, templates }: { service: Service; templates: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded p-1 text-muted hover:bg-background hover:text-foreground" aria-label={`Edit ${service.name}`}><Pencil size={14} /></button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-20" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-surface p-5 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-base font-semibold">Edit {service.name}</h2>
            <Form service={service} templates={templates} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
