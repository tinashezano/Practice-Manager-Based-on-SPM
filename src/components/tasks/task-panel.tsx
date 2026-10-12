"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, Paperclip, Trash2, X } from "lucide-react";
import { useState } from "react";
import { addComment, attachFiles, deleteTask, removeAttachment, updateTask } from "@/app/(app)/tasks/actions";
import { Avatar } from "@/components/avatar";
import { Button, inputClass } from "@/components/ui";
import { formatDate, formatDateTime, toISODate, todayISO } from "@/lib/dates";
import { formatMinutes } from "@/lib/time-format";
import { TaskTimer, type RunningTimer } from "@/components/timer";
import { logTimeAction } from "@/app/(app)/time/actions";
import { ACCEPT_ATTR, formatBytes } from "@/lib/file-meta";
import type { TaskDetail } from "@/lib/task-queries";
import { PRIORITIES, PRIORITY_META, RECURRENCE_LABELS, STATUS_META, TASK_STATUSES, taskHome } from "@/lib/task-meta";
import { DueDate, StatusBadge } from "./task-bits";
import { QuickAdd } from "./quick-add";
import { useAction } from "./use-action";
import { useParamLink } from "./use-task-link";

type Option = { id: string; name: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[100px_1fr] items-center gap-2 text-xs text-muted">
      {label}
      <div className="text-sm text-foreground">{children}</div>
    </label>
  );
}

const fieldClass = `${inputClass} py-1.5`;

export function TaskPanel({
  task,
  staff,
  projects,
  resources,
  running,
  loggedMinutes,
  canEdit,
  canDelete,
}: {
  task: TaskDetail;
  staff: Option[];
  projects: Option[];
  resources: Option[];
  running: RunningTimer;
  loggedMinutes: number;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { hrefWith } = useParamLink();
  const { run, pending, toast } = useAction();
  const [comment, setComment] = useState("");
  const [logged, setLogged] = useState(0);
  const save = (patch: Parameters<typeof updateTask>[1]) => run(() => updateTask(task.id, patch));
  // Re-mount uncontrolled inputs whenever the task changes on the server.
  const k = `${task.id}-${task.updatedAt.toISOString()}`;
  const disabled = !canEdit || pending;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col border-l border-border bg-surface shadow-2xl">
      {toast}
      <div className="flex items-center gap-1 border-b border-border px-5 py-3 text-xs text-muted">
        {taskHome(task).isLead && <span className="rounded bg-amber-50 px-1.5 text-warning">Lead</span>}
        <Link href={taskHome(task).href} className="hover:text-brand">{taskHome(task).name}</Link>
        {task.project && (<><ChevronRight size={12} /><span>{task.project.name}</span></>)}
        {task.parent && (<><ChevronRight size={12} /><Link href={hrefWith({ task: task.parent.id })} scroll={false} className="truncate hover:text-brand">{task.parent.title}</Link></>)}
        <Link href={hrefWith({ task: null })} scroll={false} className="ml-auto rounded p-1 hover:bg-background" aria-label="Close"><X size={16} /></Link>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
        <div>
          <input
            key={`title-${k}`}
            defaultValue={task.title}
            disabled={disabled}
            onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && save({ title: e.target.value })}
            className="w-full rounded-md border border-transparent px-1 py-0.5 text-lg font-semibold outline-none hover:border-border focus:border-brand disabled:bg-transparent"
          />
          {!canEdit && <p className="mt-1 px-1 text-xs text-muted">Read only. You can comment, but only people working on this task (or Directors/Accountants) can edit it.</p>}
        </div>

        <div className="space-y-2.5" key={`fields-${k}`}>
          <Field label="Status">
            <select defaultValue={task.status} disabled={disabled} onChange={(e) => save({ status: e.target.value as TaskDetail["status"] })} className={fieldClass}>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select defaultValue={task.priority} disabled={disabled} onChange={(e) => save({ priority: e.target.value as TaskDetail["priority"] })} className={fieldClass}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </select>
          </Field>
          <Field label="Assignee">
            <select defaultValue={task.assigneeId ?? ""} disabled={disabled} onChange={(e) => save({ assigneeId: e.target.value || null })} className={fieldClass}>
              <option value="">Unassigned</option>
              {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Reviewer">
            <select defaultValue={task.reviewerId ?? ""} disabled={disabled} onChange={(e) => save({ reviewerId: e.target.value || null })} className={fieldClass}>
              <option value="">No reviewer</option>
              {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Start date">
            <input type="date" defaultValue={toISODate(task.startDate)} disabled={disabled} onChange={(e) => save({ startDate: e.target.value || null })} className={fieldClass} />
          </Field>
          <Field label="Due date">
            <input type="date" defaultValue={toISODate(task.dueDate)} disabled={disabled} onChange={(e) => save({ dueDate: e.target.value || null })} className={fieldClass} />
          </Field>
          <Field label="Estimate (h)">
            <input
              type="number"
              min={0}
              step={0.25}
              defaultValue={task.estimateMinutes ? Math.round((task.estimateMinutes / 60) * 100) / 100 : ""}
              disabled={disabled}
              onBlur={(e) => {
                const mins = e.target.value === "" ? null : Math.round(Number(e.target.value) * 60);
                if (mins !== task.estimateMinutes) save({ estimateMinutes: mins });
              }}
              className={fieldClass}
            />
          </Field>
          {!task.parent && (
            <Field label="Repeats">
              <select defaultValue={task.recurrence} disabled={disabled} onChange={(e) => save({ recurrence: e.target.value as TaskDetail["recurrence"] })} className={fieldClass}>
                {Object.entries(RECURRENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          )}
          <Field label="SOP">
            <select defaultValue={task.resourceId ?? ""} disabled={disabled} onChange={(e) => save({ resourceId: e.target.value || null })} className={fieldClass}>
              <option value="">None</option>
              {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          {!task.parent && task.clientId && (
            <Field label="Project">
              <select defaultValue={task.projectId ?? ""} disabled={disabled} onChange={(e) => save({ projectId: e.target.value || null })} className={fieldClass}>
                <option value="">General (no project)</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
        </div>

        {task.resource ? (
          <Link href={`/resources/${task.resource.id}`} target="_blank" className="flex items-start gap-3 rounded-lg border border-brand/30 bg-brand-soft/60 p-3 hover:border-brand">
            <BookOpen size={18} className="mt-0.5 shrink-0 text-brand" />
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wide text-brand">How to do this</span>
              <span className="block text-sm font-medium">{task.resource.title}</span>
              {task.resource.summary && <span className="block text-xs text-muted">{task.resource.summary}</span>}
            </span>
          </Link>
        ) : null}

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Description</div>
          <textarea
            key={`desc-${k}`}
            defaultValue={task.description ?? ""}
            disabled={disabled}
            rows={4}
            placeholder={canEdit ? "Add details, steps or links…" : "No description."}
            onBlur={(e) => e.target.value !== (task.description ?? "") && save({ description: e.target.value || null })}
            className={`${inputClass} resize-y`}
          />
        </div>

        {!task.parent && (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Subtasks {task.subtasks.length > 0 && `(${task.subtasks.filter((s) => s.status === "DONE").length}/${task.subtasks.length})`}
            </div>
            <div className="divide-y divide-border rounded-lg border border-border">
              {task.subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={s.status === "DONE"}
                    disabled={disabled}
                    onChange={(e) => run(() => updateTask(s.id, { status: e.target.checked ? "DONE" : "TODO" }))}
                    className="h-4 w-4 accent-[var(--success)]"
                  />
                  <Link href={hrefWith({ task: s.id })} scroll={false} className={clsx("flex-1 truncate text-sm hover:text-brand", s.status === "DONE" && "text-muted line-through")}>
                    {s.title}
                  </Link>
                  {s.status !== "DONE" && s.status !== "TODO" && <StatusBadge status={s.status} />}
                  <DueDate date={s.dueDate} done={s.status === "DONE"} />
                  <Avatar user={s.assignee} size="xs" />
                </div>
              ))}
              {canEdit && <div className="px-3"><QuickAdd parentId={task.id} label="Add subtask" /></div>}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Time · {formatMinutes(loggedMinutes)} logged{task.estimateMinutes ? ` of ${formatMinutes(task.estimateMinutes)} estimated` : ""}</span>
          </div>
          {task.estimateMinutes ? (
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-background">
              <div className={clsx("h-full", loggedMinutes > task.estimateMinutes ? "bg-danger" : "bg-brand")} style={{ width: `${Math.min(100, (loggedMinutes / task.estimateMinutes) * 100)}%` }} />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <TaskTimer taskId={task.id} running={running} />
            <form
              action={(fd) => run(() => logTimeAction({ taskId: task.id, clientId: null, date: String(fd.get("date")), duration: String(fd.get("duration")), description: String(fd.get("note") ?? "") || null }), () => setLogged((n) => n + 1))}
              key={`log-${logged}`}
              className="flex items-center gap-1.5"
            >
              <input name="duration" required placeholder="1h30" className={`${inputClass} w-20 py-1.5`} aria-label="Time spent" />
              <input name="date" type="date" defaultValue={todayISO()} className={`${inputClass} w-36 py-1.5`} aria-label="Date" />
              <input name="note" placeholder="Note" className={`${inputClass} w-28 py-1.5`} aria-label="Note" />
              <Button variant="secondary" disabled={pending}>Log</Button>
            </form>
          </div>
          {task.timeEntries.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {task.timeEntries.slice(0, 5).map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="w-20">{formatDate(e.date, { day: "numeric", month: "short" })}</span>
                  <span className="w-16 font-medium text-foreground">{formatMinutes(e.minutes)}</span>
                  <span className="truncate">{e.user.name}{e.description && ` · ${e.description}`}{!e.billable && " · non-billable"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Attachments ({task.attachments.length})</div>
          <ul className="space-y-1">
            {task.attachments.map((a) => (
              <li key={a.id} className="group flex items-center gap-2 text-sm">
                <Paperclip size={13} className="text-muted" />
                <a href={`/api/files/${a.file.id}?view=1`} target="_blank" className="truncate text-brand hover:underline">{a.file.name}</a>
                <span className="text-xs text-muted">{formatBytes(a.file.size)}</span>
                <button onClick={() => confirm(`Remove ${a.file.name}?`) && run(() => removeAttachment(a.id))} className="ml-auto text-muted opacity-0 hover:text-danger group-hover:opacity-100" aria-label={`Remove ${a.file.name}`}><X size={13} /></button>
              </li>
            ))}
          </ul>
          {canEdit && (
            <form action={(fd) => run(() => attachFiles(task.id, fd))} className="mt-2 flex items-center gap-2">
              <input type="file" name="files" multiple accept={ACCEPT_ATTR} className="min-w-0 flex-1 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-brand-soft file:px-2.5 file:py-1 file:text-brand" />
              <Button variant="secondary" disabled={pending}>Upload</Button>
            </form>
          )}
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Comments ({task.comments.length})</div>
          <div className="space-y-3">
            {task.comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <Avatar user={c.author} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs"><span className="font-medium">{c.author.name}</span> <span className="text-muted">· {formatDateTime(c.createdAt)}</span></div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Ask a question or post an update… use @name to notify someone"
              className={`${inputClass} resize-y`}
            />
            <Button variant="secondary" disabled={pending || !comment.trim()} onClick={() => run(() => addComment(task.id, comment), () => setComment(""))}>
              Post comment
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted">
        <span>Created {task.createdBy ? `by ${task.createdBy.name} ` : ""}{formatDateTime(task.createdAt)}</span>
        {canDelete && (
          <button
            onClick={() => {
              if (!confirm(`Delete "${task.title}"${task.subtasks.length ? " and its subtasks" : ""}?`)) return;
              run(() => deleteTask(task.id), () => router.push(hrefWith({ task: task.parent?.id ?? null }), { scroll: false }));
            }}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-danger hover:bg-red-50"
          >
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    </aside>
  );
}
