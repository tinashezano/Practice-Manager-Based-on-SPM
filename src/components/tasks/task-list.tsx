"use client";

import clsx from "clsx";
import Link from "next/link";
import { ChevronDown, ChevronRight, FolderKanban } from "lucide-react";
import { useState } from "react";
import { updateTask } from "@/app/(app)/tasks/actions";
import { Avatar } from "@/components/avatar";
import type { TaskRow } from "@/lib/task-queries";
import { CommentCount, DueDate, PriorityBadge, StatusBadge, SubtaskProgress } from "./task-bits";
import { QuickAdd } from "./quick-add";
import { useAction } from "./use-action";
import { useParamLink } from "./use-task-link";

type Group = { key: string; clientId: string; clientName: string; projects: { id: string | null; name: string; tasks: TaskRow[] }[] };

function groupTasks(tasks: TaskRow[]): Group[] {
  const clients = new Map<string, Group>();
  for (const t of tasks) {
    let g = clients.get(t.clientId);
    if (!g) {
      g = { key: t.clientId, clientId: t.clientId, clientName: t.client.name, projects: [] };
      clients.set(t.clientId, g);
    }
    const pid = t.project?.id ?? null;
    let p = g.projects.find((x) => x.id === pid);
    if (!p) {
      p = { id: pid, name: t.project?.name ?? "General", tasks: [] };
      g.projects.push(p);
    }
    p.tasks.push(t);
  }
  for (const g of clients.values()) g.projects.sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : a.name.localeCompare(b.name)));
  return [...clients.values()];
}

function Check({ done, onToggle, disabled }: { done: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-label={done ? "Mark as not done" : "Mark as done"}
      className={clsx(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
        done ? "border-success bg-success text-white" : "border-slate-300 hover:border-success",
      )}
    >
      {done && <svg viewBox="0 0 12 12" className="h-2.5 w-2.5"><path d="M2.5 6.5l2.2 2L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>}
    </button>
  );
}

function Row({ task, depth, expanded, onExpand }: { task: TaskRow | TaskRow["subtasks"][number]; depth: number; expanded?: boolean; onExpand?: () => void }) {
  const { hrefWith, params } = useParamLink();
  const { run, pending, toast } = useAction();
  const done = task.status === "DONE";
  const selected = params.get("task") === task.id;
  const subtasks = "subtasks" in task ? task.subtasks : [];
  const comments = "_count" in task ? task._count.comments : 0;

  return (
    <div
      className={clsx(
        "group grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-3 py-2 last:border-0 sm:grid-cols-[1fr_130px_90px_100px_32px]",
        selected ? "bg-brand-soft" : "hover:bg-background",
      )}
    >
      {toast}
      <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: depth * 24 }}>
        {onExpand && subtasks.length > 0 ? (
          <button onClick={onExpand} className="text-muted hover:text-foreground" aria-label="Toggle subtasks">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <Check done={done} disabled={pending} onToggle={() => run(() => updateTask(task.id, { status: done ? "TODO" : "DONE" }))} />
        <Link href={hrefWith({ task: task.id })} scroll={false} className={clsx("truncate text-sm hover:text-brand", done && "text-muted line-through")}>
          {task.title}
        </Link>
        <SubtaskProgress subtasks={subtasks} />
        <CommentCount count={comments} />
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="hidden sm:block"><StatusBadge status={task.status} /></div>
      <div className="hidden sm:block"><DueDate date={task.dueDate} done={done} /></div>
      <div className="hidden truncate text-xs text-muted sm:block">{task.assignee?.name.split(" ")[0] ?? "Unassigned"}</div>
      <Avatar user={task.assignee} />
    </div>
  );
}

function TaskWithSubtasks({ task }: { task: TaskRow }) {
  const [expanded, setExpanded] = useState(task.subtasks.some((s) => s.status !== "DONE"));
  return (
    <>
      <Row task={task} depth={0} expanded={expanded} onExpand={() => setExpanded((e) => !e)} />
      {expanded && (
        <>
          {task.subtasks.map((s) => <Row key={s.id} task={s} depth={1} />)}
          <div className="border-b border-border px-3"><QuickAdd parentId={task.id} label="Add subtask" indent={70} /></div>
        </>
      )}
    </>
  );
}

export function TaskList({ tasks, showClients = true, emptyText = "No tasks match these filters." }: { tasks: TaskRow[]; showClients?: boolean; emptyText?: string }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = groupTasks(tasks);

  if (!groups.length) return <div className="rounded-xl border border-dashed border-border bg-surface py-14 text-center text-sm text-muted">{emptyText}</div>;

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const open = g.projects.reduce((n, p) => n + p.tasks.filter((t) => t.status !== "DONE").length, 0);
        return (
          <section key={g.key} className="overflow-hidden rounded-xl border border-border bg-surface">
            {showClients && (
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}
                className="flex w-full items-center gap-2 border-b border-border bg-background/60 px-3 py-2.5 text-left"
              >
                {collapsed[g.key] ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                <Link href={`/clients/${g.clientId}`} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold hover:text-brand">
                  {g.clientName}
                </Link>
                <span className="text-xs text-muted">{open} open</span>
              </button>
            )}
            {!collapsed[g.key] &&
              g.projects.map((p) => (
                <div key={p.id ?? "none"}>
                  <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs font-medium text-muted">
                    <FolderKanban size={13} /> {p.name}
                  </div>
                  {p.tasks.map((t) => <TaskWithSubtasks key={t.id} task={t} />)}
                  <div className="border-b border-border px-3 last:border-0"><QuickAdd clientId={g.clientId} projectId={p.id} indent={22} /></div>
                </div>
              ))}
          </section>
        );
      })}
    </div>
  );
}
