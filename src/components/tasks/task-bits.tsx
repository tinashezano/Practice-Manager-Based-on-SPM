import clsx from "clsx";
import { CalendarDays, MessageSquare } from "lucide-react";
import type { Priority, TaskStatus } from "@prisma/client";
import { Badge } from "@/components/ui";
import { formatDate, toISODate, todayISO } from "@/lib/dates";
import { PRIORITY_META, STATUS_META } from "@/lib/task-meta";

export function StatusBadge({ status }: { status: TaskStatus }) {
  const m = STATUS_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function StatusDot({ status }: { status: TaskStatus }) {
  return <span className={clsx("inline-block h-2 w-2 shrink-0 rounded-full", STATUS_META[status].dot)} />;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "MEDIUM" || priority === "LOW") return null;
  const m = PRIORITY_META[priority];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function DueDate({ date, done }: { date: Date | null; done?: boolean }) {
  if (!date) return <span className="text-xs text-muted">No due date</span>;
  const iso = toISODate(date);
  const today = todayISO();
  const overdue = !done && iso < today;
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs", overdue ? "font-medium text-danger" : iso === today && !done ? "font-medium text-warning" : "text-muted")}>
      <CalendarDays size={12} />
      {iso === today ? "Today" : formatDate(date)}
    </span>
  );
}

export function CommentCount({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted">
      <MessageSquare size={12} /> {count}
    </span>
  );
}

export function SubtaskProgress({ subtasks }: { subtasks: { status: TaskStatus }[] }) {
  if (!subtasks.length) return null;
  const done = subtasks.filter((s) => s.status === "DONE").length;
  return (
    <span className={clsx("text-xs", done === subtasks.length ? "text-success" : "text-muted")}>
      {done}/{subtasks.length}
    </span>
  );
}
