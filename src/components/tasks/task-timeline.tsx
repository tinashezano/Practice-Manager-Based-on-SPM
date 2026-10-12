"use client";

import clsx from "clsx";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { addDays, daysBetween, formatDate, TIMELINE_DAYS, toISODate, todayISO } from "@/lib/dates";
import type { TaskRow } from "@/lib/task-queries";
import { STATUS_META, taskHome } from "@/lib/task-meta";
import { useParamLink } from "./use-task-link";


const DAY_W = 30;
const BAR: Record<string, string> = {
  TODO: "bg-slate-300",
  IN_PROGRESS: "bg-indigo-400",
  WAITING_ON_CLIENT: "bg-amber-400",
  IN_REVIEW: "bg-violet-400",
  DONE: "bg-green-400",
};

export function TaskTimeline({ tasks, from, undated }: { tasks: TaskRow[]; from: string; undated: number }) {
  const { hrefWith } = useParamLink();
  const to = addDays(from, TIMELINE_DAYS - 1);
  const today = todayISO();
  const days = Array.from({ length: TIMELINE_DAYS }, (_, i) => addDays(from, i));

  const groups = new Map<string, { name: string; tasks: TaskRow[] }>();
  for (const t of tasks) {
    if (!t.startDate && !t.dueDate) continue;
    const home = taskHome(t);
    const g = groups.get(home.key) ?? { name: home.name, tasks: [] };
    g.tasks.push(t);
    groups.set(home.key, g);
  }

  const width = TIMELINE_DAYS * DAY_W;
  const todayOffset = daysBetween(from, today);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="text-sm font-semibold">
          {formatDate(from, { day: "numeric", month: "short" })} – {formatDate(to, { day: "numeric", month: "short", year: "numeric" })}
        </div>
        <div className="flex items-center gap-1">
          <Link href={hrefWith({ from: addDays(from, -14) })} scroll={false} className="rounded p-1 hover:bg-background" aria-label="Earlier"><ChevronLeft size={16} /></Link>
          <Link href={hrefWith({ from: null })} scroll={false} className="rounded px-2 py-1 text-xs hover:bg-background">Today</Link>
          <Link href={hrefWith({ from: addDays(from, 14) })} scroll={false} className="rounded p-1 hover:bg-background" aria-label="Later"><ChevronRight size={16} /></Link>
        </div>
      </div>
      <div className="flex">
        <div className="w-64 shrink-0 border-r border-border">
          <div className="h-10 border-b border-border" />
          {[...groups.values()].map((g) => (
            <div key={g.name}>
              <div className="flex h-8 items-center border-b border-border bg-background/60 px-3 text-xs font-semibold">{g.name}</div>
              {g.tasks.map((t) => (
                <Link key={t.id} href={hrefWith({ task: t.id })} scroll={false} className="flex h-9 items-center gap-2 border-b border-border px-3 text-sm hover:bg-background">
                  <Avatar user={t.assignee} size="xs" />
                  <span className={clsx("truncate", t.status === "DONE" && "text-muted line-through")}>{t.title}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div style={{ width }} className="relative">
            <div className="flex h-10 border-b border-border">
              {days.map((d) => {
                const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
                return (
                  <div key={d} style={{ width: DAY_W }} className={clsx("flex flex-col items-center justify-center text-[10px]", (dow === 0 || dow === 6) && "bg-background/70", d === today ? "font-bold text-brand" : "text-muted")}>
                    <span>{d.endsWith("-01") || d === from ? formatDate(d, { month: "short" }) : ""}</span>
                    <span>{Number(d.slice(8))}</span>
                  </div>
                );
              })}
            </div>
            {todayOffset >= 0 && todayOffset < TIMELINE_DAYS && (
              <div className="pointer-events-none absolute bottom-0 top-10 z-10 w-px bg-brand" style={{ left: todayOffset * DAY_W + DAY_W / 2 }} />
            )}
            {[...groups.values()].map((g) => (
              <div key={g.name}>
                <div className="h-8 border-b border-border bg-background/60" />
                {g.tasks.map((t) => {
                  const s = toISODate(t.startDate ?? t.dueDate);
                  const e = toISODate(t.dueDate ?? t.startDate);
                  const left = Math.max(0, daysBetween(from, s));
                  const right = Math.min(TIMELINE_DAYS - 1, daysBetween(from, e));
                  return (
                    <div key={t.id} className="relative h-9 border-b border-border">
                      {right >= left && (
                        <Link
                          href={hrefWith({ task: t.id })}
                          scroll={false}
                          title={`${t.title} · ${STATUS_META[t.status].label} · ${formatDate(s)} → ${formatDate(e)}`}
                          className={clsx("absolute top-2 h-5 rounded-md opacity-90 hover:opacity-100", BAR[t.status], e < today && t.status !== "DONE" && "ring-2 ring-danger")}
                          style={{ left: left * DAY_W + 3, width: (right - left + 1) * DAY_W - 6 }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {groups.size === 0 && <div className="py-12 text-center text-sm text-muted">No dated tasks in this period.</div>}
      {undated > 0 && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted">
          {undated} matching task{undated === 1 ? " has" : "s have"} no start or due date and {undated === 1 ? "isn't" : "aren't"} shown. Open a task to set dates.
        </div>
      )}
    </div>
  );
}
