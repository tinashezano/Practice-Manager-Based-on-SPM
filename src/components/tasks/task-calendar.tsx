"use client";

import clsx from "clsx";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useOptimistic, useState } from "react";
import { updateTask } from "@/app/(app)/tasks/actions";
import { Avatar } from "@/components/avatar";
import { addDays, formatDate, monthGridRange, toISODate, todayISO } from "@/lib/dates";
import type { TaskRow } from "@/lib/task-queries";
import { taskHome } from "@/lib/task-meta";
import { StatusDot } from "./task-bits";
import { useAction } from "./use-action";
import { useParamLink } from "./use-task-link";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TaskCalendar({ tasks, unscheduled, month }: { tasks: TaskRow[]; unscheduled: TaskRow[]; month: string }) {
  const { hrefWith } = useParamLink();
  const { run, toast } = useAction();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [optimistic, reschedule] = useOptimistic([...tasks, ...unscheduled], (state, { id, due }: { id: string; due: string }) =>
    state.map((t) => (t.id === id ? { ...t, dueDate: new Date(`${due}T00:00:00Z`) } : t)),
  );

  const { start } = monthGridRange(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = todayISO();
  const [y, m] = month.split("-").map(Number) as [number, number];
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

  const byDay = new Map<string, TaskRow[]>();
  for (const t of optimistic) {
    if (!t.dueDate) continue;
    const k = toISODate(t.dueDate);
    byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }
  const stillUnscheduled = optimistic.filter((t) => !t.dueDate);

  function drop(day: string, id: string) {
    setDragOver(null);
    const t = optimistic.find((x) => x.id === id);
    if (!t || (t.dueDate && toISODate(t.dueDate) === day)) return;
    run(async () => {
      reschedule({ id, due: day });
      return updateTask(id, { dueDate: day });
    });
  }

  const chip = (t: TaskRow) => (
    <Link
      key={t.id}
      href={hrefWith({ task: t.id })}
      scroll={false}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/task", t.id)}
      title={`${taskHome(t).name} · ${t.title}`}
      className={clsx("flex items-center gap-1.5 truncate rounded-md border border-border bg-surface px-1.5 py-1 text-[11px] hover:border-brand", t.status === "DONE" && "text-muted line-through")}
    >
      <StatusDot status={t.status} />
      <span className="truncate">{t.title}</span>
      <span className="ml-auto"><Avatar user={t.assignee} size="xs" /></span>
    </Link>
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {toast}
      <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="text-sm font-semibold">{formatDate(`${month}-01`, { month: "long", year: "numeric" })}</div>
          <div className="flex items-center gap-1">
            <Link href={hrefWith({ month: prev })} scroll={false} className="rounded p-1 hover:bg-background" aria-label="Previous month"><ChevronLeft size={16} /></Link>
            <Link href={hrefWith({ month: null })} scroll={false} className="rounded px-2 py-1 text-xs hover:bg-background">Today</Link>
            <Link href={hrefWith({ month: next })} scroll={false} className="rounded p-1 hover:bg-background" aria-label="Next month"><ChevronRight size={16} /></Link>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-border text-center text-[11px] font-medium text-muted">
          {WEEKDAYS.map((d) => <div key={d} className="py-1.5">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = day.startsWith(month);
            const items = byDay.get(day) ?? [];
            return (
              <div
                key={day}
                onDragOver={(e) => { e.preventDefault(); setDragOver(day); }}
                onDragLeave={() => setDragOver((d) => (d === day ? null : d))}
                onDrop={(e) => drop(day, e.dataTransfer.getData("text/task"))}
                className={clsx("min-h-28 border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-background/60", dragOver === day && "bg-brand-soft")}
              >
                <div className={clsx("mb-1 text-right text-[11px]", day === today ? "font-bold text-brand" : inMonth ? "text-foreground" : "text-muted")}>
                  {Number(day.slice(8))}
                </div>
                <div className="space-y-1">
                  {items.slice(0, 4).map(chip)}
                  {items.length > 4 && <div className="px-1 text-[11px] text-muted">+{items.length - 4} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <aside className="w-full shrink-0 rounded-xl border border-border bg-surface p-3 lg:w-64">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">No due date ({stillUnscheduled.length})</div>
        <p className="mb-2 text-[11px] text-muted">Drag onto a day to schedule.</p>
        <div className="space-y-1">{stillUnscheduled.slice(0, 40).map(chip)}</div>
      </aside>
    </div>
  );
}
