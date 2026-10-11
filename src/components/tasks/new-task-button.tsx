"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { createTask } from "@/app/(app)/tasks/actions";
import { Button, inputClass } from "@/components/ui";
import { PRIORITIES, PRIORITY_META } from "@/lib/task-meta";
import { useAction } from "./use-action";
import { useParamLink } from "./use-task-link";

type Option = { id: string; name: string };

export function NewTaskButton({
  clients,
  projects,
  staff,
  currentUserId,
  defaultClientId,
}: {
  clients: Option[];
  projects: (Option & { clientId: string })[];
  staff: Option[];
  currentUserId: string;
  defaultClientId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const { run, pending, toast } = useAction();
  const { go } = useParamLink();

  function submit(fd: FormData) {
    run(
      () =>
        createTask({
          title: String(fd.get("title") ?? ""),
          clientId: clientId || undefined,
          projectId: (fd.get("projectId") as string) || null,
          assigneeId: (fd.get("assigneeId") as string) || null,
          dueDate: (fd.get("dueDate") as string) || null,
          priority: fd.get("priority") as (typeof PRIORITIES)[number],
        }),
      (r) => {
        setOpen(false);
        go({ task: r.id });
      },
    );
  }

  return (
    <>
      {toast}
      <Button onClick={() => setOpen(true)}><Plus size={15} /> New task</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-24" onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-xl bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">New task</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-foreground" aria-label="Close"><X size={18} /></button>
            </div>
            <input name="title" required autoFocus placeholder="What needs to be done?" className={inputClass} />
            <label className="block text-xs font-medium text-muted">
              Client
              <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${inputClass} mt-1`}>
                <option value="" disabled>Choose a client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted">
              Project
              <select name="projectId" key={clientId} className={`${inputClass} mt-1`}>
                <option value="">General (no project)</option>
                {projects.filter((p) => p.clientId === clientId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-xs font-medium text-muted">
                Assignee
                <select name="assigneeId" defaultValue={currentUserId} className={`${inputClass} mt-1`}>
                  <option value="">Unassigned</option>
                  {staff.map((u) => <option key={u.id} value={u.id}>{u.name.split(" ")[0]}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-muted">
                Due
                <input name="dueDate" type="date" className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-xs font-medium text-muted">
                Priority
                <select name="priority" defaultValue="MEDIUM" className={`${inputClass} mt-1`}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={pending}>{pending ? "Creating…" : "Create task"}</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
