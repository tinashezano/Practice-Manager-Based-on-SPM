"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { useAction } from "@/components/tasks/use-action";
import { Button, inputBase, inputClass } from "@/components/ui";
import { todayISO } from "@/lib/dates";
import { addStep, cancelEnrollment, deleteStep, enrollAction, moveStep, updateProgramme, updateStep, type FormState } from "./actions";

type Opt = { id: string; name: string };

export function EnrollForm({ programmes, staff }: { programmes: Opt[]; staff: Opt[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(enrollAction, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_150px_auto] sm:items-end">
      <label className="text-xs font-medium text-muted">Programme<select name="programmeId" className={`${inputClass} mt-1`}>{programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="text-xs font-medium text-muted">Team member<select name="userId" className={`${inputClass} mt-1`}><option value="">Choose…</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <label className="text-xs font-medium text-muted">Mentor<select name="mentorId" className={`${inputClass} mt-1`}><option value="">None</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <label className="text-xs font-medium text-muted">Start date<input type="date" name="startDate" defaultValue={todayISO()} className={`${inputClass} mt-1`} /></label>
      <Button disabled={pending || !programmes.length}>{pending ? "Enrolling…" : "Enrol"}</Button>
      {state.error && <p className="text-sm text-danger sm:col-span-5">{state.error}</p>}
    </form>
  );
}

type Step = { id: string; title: string; description: string | null; resourceId: string | null; dueOffsetDays: number; estimateMinutes: number | null };

function StepRow({ s, resources, first, last }: { s: Step; resources: { id: string; title: string }[]; first: boolean; last: boolean }) {
  const { run, toast } = useAction();
  const save = (patch: Parameters<typeof updateStep>[1]) => run(() => updateStep(s.id, patch));
  const k = `${s.id}-${s.title}-${s.dueOffsetDays}`;
  return (
    <div className="space-y-2 border-b border-border p-3 last:border-0">
      {toast}
      <div className="grid grid-cols-[1fr_90px_90px_80px] items-center gap-2">
        <input key={`t${k}`} defaultValue={s.title} onBlur={(e) => e.target.value.trim().length > 1 && e.target.value !== s.title && save({ title: e.target.value })} className={`${inputClass} py-1 font-medium`} aria-label="Step" />
        <label className="flex items-center gap-1 text-xs text-muted">Day<input key={`d${k}`} type="number" min={0} defaultValue={s.dueOffsetDays} onBlur={(e) => save({ dueOffsetDays: Number(e.target.value) || 0 })} className={`${inputBase} w-full py-1 text-right`} /></label>
        <label className="flex items-center gap-1 text-xs text-muted">Hrs<input key={`h${k}`} type="number" min={0} step={0.25} defaultValue={s.estimateMinutes ? Math.round((s.estimateMinutes / 60) * 100) / 100 : ""} onBlur={(e) => save({ estimateMinutes: e.target.value === "" ? null : Math.round(Number(e.target.value) * 60) })} className={`${inputBase} w-full py-1 text-right`} /></label>
        <div className="flex justify-end gap-0.5 text-muted">
          <button disabled={first} onClick={() => run(() => moveStep(s.id, -1))} className="rounded p-1 hover:text-foreground disabled:opacity-30" aria-label="Move up"><ArrowUp size={13} /></button>
          <button disabled={last} onClick={() => run(() => moveStep(s.id, 1))} className="rounded p-1 hover:text-foreground disabled:opacity-30" aria-label="Move down"><ArrowDown size={13} /></button>
          <button onClick={() => confirm(`Delete "${s.title}"?`) && run(() => deleteStep(s.id))} className="rounded p-1 hover:text-danger" aria-label="Delete step"><Trash2 size={13} /></button>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_260px] gap-2">
        <input key={`x${k}`} defaultValue={s.description ?? ""} placeholder="Details for the new team member (optional)" onBlur={(e) => e.target.value !== (s.description ?? "") && save({ description: e.target.value || null })} className={`${inputClass} py-1 text-xs`} />
        <select value={s.resourceId ?? ""} onChange={(e) => save({ resourceId: e.target.value || null })} className={`${inputBase} py-1 text-xs`} aria-label="SOP to read">
          <option value="">No SOP to read</option>
          {resources.map((r) => <option key={r.id} value={r.id}>Read: {r.title}</option>)}
        </select>
      </div>
    </div>
  );
}

export function ProgrammeEditor({ id, name, description, active, steps, resources }: { id: string; name: string; description: string; active: boolean; steps: Step[]; resources: { id: string; title: string }[] }) {
  const { run, pending, toast } = useAction();
  const [v, setV] = useState({ name, description, active });
  const dirty = v.name !== name || v.description !== description || v.active !== active;
  return (
    <div className="space-y-4">
      {toast}
      <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={`${inputClass} text-lg font-semibold`} aria-label="Programme name" />
      <textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={2} placeholder="Who it's for and what they'll learn" className={inputClass} />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Active</label>
        <Button variant="secondary" disabled={!dirty || pending} onClick={() => run(() => updateProgramme(id, v))}>Save</Button>
      </div>
      <div className="rounded-xl border border-border bg-surface">
        {steps.map((s, i) => <StepRow key={s.id} s={s} resources={resources} first={i === 0} last={i === steps.length - 1} />)}
        {!steps.length && <p className="p-6 text-center text-sm text-muted">No steps yet.</p>}
      </div>
      <Button variant="secondary" onClick={() => run(() => addStep(id))}><Plus size={14} /> Add step</Button>
      <p className="text-xs text-muted">“Day” is days after the start date. Steps with an SOP are completed when the person clicks “I&apos;ve read this” on it. Changes apply to future enrolments.</p>
    </div>
  );
}

export function CancelEnrollment({ id }: { id: string }) {
  const { run, pending, toast } = useAction();
  return (
    <>
      {toast}
      <Button variant="ghost" className="text-danger" disabled={pending} onClick={() => confirm("Cancel this programme? Its open tasks will be removed.") && run(() => cancelEnrollment(id))}>Cancel programme</Button>
    </>
  );
}
