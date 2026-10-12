"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Priority } from "@prisma/client";
import { useAction } from "@/components/tasks/use-action";
import { Button, inputBase, inputClass } from "@/components/ui";
import { PRIORITIES, PRIORITY_META } from "@/lib/task-meta";
import { addTemplateTask, deleteTemplate, deleteTemplateTask, moveTemplateTask, updateTemplate, updateTemplateTask } from "../actions";

type T = { id: string; title: string; dueOffsetDays: number | null; estimateMinutes: number | null; priority: Priority; resourceId: string | null; subtasks: T[] };
type Opt = { id: string; title: string };

function Row({ t, depth, resources, first, last }: { t: T; depth: number; resources: Opt[]; first: boolean; last: boolean }) {
  const { run, toast } = useAction();
  const save = (patch: Parameters<typeof updateTemplateTask>[1]) => run(() => updateTemplateTask(t.id, patch));
  const k = `${t.id}-${t.title}-${t.dueOffsetDays}-${t.estimateMinutes}`;
  return (
    <div className="grid grid-cols-[1fr_80px_80px_110px_minmax(140px,220px)_80px] items-center gap-2 border-b border-border px-3 py-2 last:border-0" style={{ paddingLeft: 12 + depth * 28 }}>
      {toast}
      <input key={`t${k}`} defaultValue={t.title} onBlur={(e) => e.target.value.trim() && e.target.value !== t.title && save({ title: e.target.value })} className={`${inputClass} py-1 ${depth ? "text-xs" : "font-medium"}`} aria-label="Task title" />
      <input key={`d${k}`} type="number" min={0} defaultValue={t.dueOffsetDays ?? ""} placeholder="—" onBlur={(e) => save({ dueOffsetDays: e.target.value === "" ? null : Number(e.target.value) })} className={`${inputBase} w-full py-1 text-right`} aria-label="Due (days after start)" />
      <input key={`e${k}`} type="number" min={0} step={0.25} defaultValue={t.estimateMinutes ? Math.round((t.estimateMinutes / 60) * 100) / 100 : ""} placeholder="—" onBlur={(e) => save({ estimateMinutes: e.target.value === "" ? null : Math.round(Number(e.target.value) * 60) })} className={`${inputBase} w-full py-1 text-right`} aria-label="Estimate (hours)" />
      <select value={t.priority} onChange={(e) => save({ priority: e.target.value as Priority })} className={`${inputBase} py-1 text-xs`} aria-label="Priority">
        {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
      </select>
      <select value={t.resourceId ?? ""} onChange={(e) => save({ resourceId: e.target.value || null })} className={`${inputBase} py-1 text-xs`} aria-label="SOP">
        <option value="">No SOP</option>
        {resources.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
      </select>
      <div className="flex items-center justify-end gap-0.5 text-muted">
        <button disabled={first} onClick={() => run(() => moveTemplateTask(t.id, -1))} className="rounded p-1 hover:text-foreground disabled:opacity-30" aria-label="Move up"><ArrowUp size={13} /></button>
        <button disabled={last} onClick={() => run(() => moveTemplateTask(t.id, 1))} className="rounded p-1 hover:text-foreground disabled:opacity-30" aria-label="Move down"><ArrowDown size={13} /></button>
        <button onClick={() => confirm(`Delete "${t.title}"${t.subtasks.length ? " and its subtasks" : ""}?`) && run(() => deleteTemplateTask(t.id))} className="rounded p-1 hover:text-danger" aria-label="Delete"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

export function TemplateEditor({ id, name, description, tasks, resources }: { id: string; name: string; description: string; tasks: T[]; resources: Opt[] }) {
  const { run, pending, toast } = useAction();
  const [v, setV] = useState({ name, description });
  const dirty = v.name !== name || v.description !== description;
  return (
    <div className="space-y-4">
      {toast}
      <div className="space-y-2">
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={`${inputClass} text-lg font-semibold`} aria-label="Template name" />
        <input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="What this job covers" className={inputClass} aria-label="Description" />
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!dirty || pending} onClick={() => run(() => updateTemplate(id, v))}>Save name</Button>
          <Button variant="ghost" className="ml-auto text-danger" onClick={() => confirm("Delete this template? Existing projects keep their tasks.") && run(() => deleteTemplate(id))}><Trash2 size={14} /> Delete template</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <div className="grid min-w-[760px] grid-cols-[1fr_80px_80px_110px_minmax(140px,220px)_80px] gap-2 border-b border-border bg-background px-3 py-2 text-xs font-medium text-muted">
          <span>Task</span><span className="text-right">Due day</span><span className="text-right">Hours</span><span>Priority</span><span>SOP</span><span />
        </div>
        <div className="min-w-[760px]">
          {tasks.map((t, i) => (
            <div key={t.id}>
              <Row t={t} depth={0} resources={resources} first={i === 0} last={i === tasks.length - 1} />
              {t.subtasks.map((s, j) => <Row key={s.id} t={s} depth={1} resources={resources} first={j === 0} last={j === t.subtasks.length - 1} />)}
              <div className="border-b border-border py-1 pl-10"><button onClick={() => run(() => addTemplateTask(id, t.id))} className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand"><Plus size={12} /> Add subtask</button></div>
            </div>
          ))}
          {!tasks.length && <p className="px-3 py-6 text-center text-sm text-muted">No tasks yet.</p>}
        </div>
      </div>
      <Button variant="secondary" onClick={() => run(() => addTemplateTask(id, null))}><Plus size={14} /> Add task</Button>
      <p className="text-xs text-muted">“Due day” is the number of days after the project start date. Changes apply to new projects; existing projects keep their tasks.</p>
    </div>
  );
}
