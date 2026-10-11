"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button, inputClass } from "@/components/ui";
import { todayISO } from "@/lib/dates";
import { addContact, createProject, type FormState } from "../actions";

function useResetOnSuccess(state: FormState, pending: boolean, onDone: () => void) {
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) onDone();
    wasPending.current = pending;
  }, [pending, state, onDone]);
}

export function AddContactForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(addContact, {});
  useResetOnSuccess(state, pending, () => setOpen(false));
  if (!open) return <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand"><Plus size={13} /> Add contact</button>;
  return (
    <form action={action} className="space-y-2 rounded-lg border border-border p-3">
      <input type="hidden" name="clientId" value={clientId} />
      <input name="name" required placeholder="Full name" className={inputClass} />
      <div className="grid grid-cols-2 gap-2">
        <input name="email" type="email" placeholder="Email" className={inputClass} />
        <input name="phone" placeholder="Phone" className={inputClass} />
      </div>
      <input name="position" placeholder="Role (e.g. Director, Finance manager)" className={inputClass} />
      <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="isPrimary" /> Primary contact</label>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={pending}>Save contact</Button>
      </div>
    </form>
  );
}

export function NewProjectForm({
  clientId,
  templates,
  staff,
  currentUserId,
}: {
  clientId: string;
  templates: { id: string; name: string; description: string | null; taskCount: number }[];
  staff: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(createProject, {});
  useResetOnSuccess(state, pending, () => setOpen(false));
  const template = templates.find((t) => t.id === templateId);

  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}><Plus size={15} /> New project</Button>;
  return (
    <form action={action} className="space-y-2 rounded-lg border border-border p-3">
      <input type="hidden" name="clientId" value={clientId} />
      <label className="block text-xs font-medium text-muted">
        Start from a template
        <select name="templateId" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={`${inputClass} mt-1`}>
          <option value="">Blank project</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.taskCount} tasks)</option>)}
        </select>
      </label>
      {template?.description && <p className="text-xs text-muted">{template.description}</p>}
      <label className="block text-xs font-medium text-muted">
        Project name {template && "(optional)"}
        <input name="name" required={!template} placeholder={template ? `${template.name}: e.g. March 2026` : "e.g. Bookkeeping"} className={`${inputClass} mt-1`} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block text-xs font-medium text-muted">
          Owner
          <select name="ownerId" defaultValue={currentUserId} className={`${inputClass} mt-1`}>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name.split(" ")[0]}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-muted">
          Start
          <input name="startDate" type="date" defaultValue={todayISO()} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-muted">
          Due
          <input name="dueDate" type="date" className={`${inputClass} mt-1`} />
        </label>
      </div>
      {template && <p className="text-xs text-muted">Tasks are assigned to the owner and dated from the start date.</p>}
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={pending}>{pending ? "Creating…" : "Create project"}</Button>
      </div>
    </form>
  );
}
