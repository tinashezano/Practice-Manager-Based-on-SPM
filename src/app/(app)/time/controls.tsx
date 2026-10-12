"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/tasks/use-action";
import { Button, inputBase, inputClass } from "@/components/ui";
import { formatMinutes } from "@/lib/time-format";
import { deleteEntry, logTimeAction, updateEntry } from "./actions";

type TaskOpt = { id: string; title: string; group: string };
type ClientOpt = { id: string; name: string };

export function AddEntry({ tasks, clients, defaultDate, userId }: { tasks: TaskOpt[]; clients: ClientOpt[]; defaultDate: string; userId: string }) {
  const { run, pending, toast } = useAction();
  const [target, setTarget] = useState(tasks[0] ? `t:${tasks[0].id}` : clients[0] ? `c:${clients[0].id}` : "");
  const [n, setN] = useState(0);
  const groups = [...new Set(tasks.map((t) => t.group))];
  return (
    <form
      key={n}
      action={(fd) => {
        const [kind, id] = target.split(":");
        run(
          () =>
            logTimeAction({
              userId,
              taskId: kind === "t" ? id! : null,
              clientId: kind === "c" ? id! : null,
              date: String(fd.get("date")),
              duration: String(fd.get("duration")),
              billable: fd.get("billable") === "auto" ? undefined : fd.get("billable") === "yes",
              description: String(fd.get("description") ?? "") || null,
            }),
          () => setN((x) => x + 1),
        );
      }}
      className="grid gap-2 sm:grid-cols-[minmax(220px,2fr)_140px_100px_130px_1fr_auto] sm:items-end"
    >
      {toast}
      <label className="text-xs font-medium text-muted">Task or client
        <select value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputClass} mt-1`}>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {tasks.filter((t) => t.group === g).map((t) => <option key={t.id} value={`t:${t.id}`}>{t.title}</option>)}
            </optgroup>
          ))}
          <optgroup label="General time for a client (no task)">
            {clients.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}
          </optgroup>
        </select>
      </label>
      <label className="text-xs font-medium text-muted">Date<input type="date" name="date" defaultValue={defaultDate} className={`${inputClass} mt-1`} /></label>
      <label className="text-xs font-medium text-muted">Time<input name="duration" required placeholder="1h30" className={`${inputClass} mt-1`} /></label>
      <label className="text-xs font-medium text-muted">Billable
        <select name="billable" defaultValue="auto" className={`${inputClass} mt-1`}>
          <option value="auto">Automatic</option>
          <option value="yes">Billable</option>
          <option value="no">Non-billable</option>
        </select>
      </label>
      <label className="text-xs font-medium text-muted">Note<input name="description" className={`${inputClass} mt-1`} /></label>
      <Button disabled={pending || !target}>{pending ? "Saving…" : "Add time"}</Button>
    </form>
  );
}

export function EntryRow({ e, editable }: { e: { id: string; date: string; dateLabel: string; label: string; sub: string; minutes: number; billable: boolean; description: string | null; running: boolean }; editable: boolean }) {
  const { run, toast } = useAction();
  return (
    <div className="grid grid-cols-[90px_1fr_90px_110px_32px] items-center gap-3 px-4 py-2 text-sm">
      {toast}
      <span className="text-muted">{e.dateLabel}</span>
      <span className="min-w-0">
        <span className="block truncate">{e.label}{e.running && <span className="ml-2 text-xs text-danger">● running</span>}</span>
        <span className="block truncate text-xs text-muted">{e.sub}{e.description && ` · ${e.description}`}</span>
      </span>
      {editable && !e.running ? (
        <input key={`${e.id}-${e.minutes}`} defaultValue={formatMinutes(e.minutes).replace(" ", "")} onBlur={(ev) => ev.target.value !== formatMinutes(e.minutes).replace(" ", "") && run(() => updateEntry(e.id, { duration: ev.target.value }))} className={`${inputBase} w-full py-1 text-right`} aria-label="Duration" />
      ) : (
        <span className="text-right">{formatMinutes(e.minutes)}</span>
      )}
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" checked={e.billable} disabled={!editable || e.running} onChange={(ev) => run(() => updateEntry(e.id, { billable: ev.target.checked }))} /> Billable
      </label>
      {editable && !e.running ? <button onClick={() => confirm("Delete this time entry?") && run(() => deleteEntry(e.id))} className="text-muted hover:text-danger" aria-label="Delete entry"><Trash2 size={14} /></button> : <span />}
    </div>
  );
}
