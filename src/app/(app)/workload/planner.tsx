"use client";

import clsx from "clsx";
import Link from "next/link";
import { Trash2, X } from "lucide-react";
import { useState } from "react";
import type { LeaveType } from "@prisma/client";
import { updateTask } from "@/app/(app)/tasks/actions";
import { Avatar } from "@/components/avatar";
import { useAction } from "@/components/tasks/use-action";
import { Button, inputBase, inputClass } from "@/components/ui";
import type { Load } from "@/lib/capacity";
import { addLeave, deleteLeave } from "./actions";

export type CellTask = { id: string; title: string; where: string; hours: number; due: string | null };
export type Cell = { week: string; planned: number; available: number; load: Load; tasks: CellTask[]; leaveDays: number };
export type Row = { user: { id: string; name: string }; weekly: number; cells: Cell[]; unscheduled: number; noEstimate: number };

const LOAD_STYLE: Record<Load, string> = {
  none: "bg-background text-muted",
  light: "bg-sky-50 text-sky-700",
  healthy: "bg-green-50 text-green-700",
  busy: "bg-amber-50 text-amber-700",
  over: "bg-red-100 text-red-700 font-semibold",
};

const h = (n: number) => `${Math.round(n * 10) / 10}h`;

export function Planner({ rows, weeks, staff, canReassign }: { rows: Row[]; weeks: { start: string; label: string; holidays: string[] }[]; staff: { id: string; name: string }[]; canReassign: boolean }) {
  const [open, setOpen] = useState<{ userId: string; week: string } | null>(null);
  const { run, pending, toast } = useAction();
  const selected = open ? rows.find((r) => r.user.id === open.userId)?.cells.find((c) => c.week === open.week) : null;
  const person = open ? rows.find((r) => r.user.id === open.userId)?.user : null;

  return (
    <div>
      {toast}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="w-52 px-4 py-2 text-left font-medium">Person</th>
              {weeks.map((w) => (
                <th key={w.start} className="px-2 py-2 text-center font-medium">
                  {w.label}
                  {w.holidays.length > 0 && <div className="text-[10px] font-normal text-warning" title={w.holidays.join(", ")}>{w.holidays.length} public holiday{w.holidays.length > 1 ? "s" : ""}</div>}
                </th>
              ))}
              <th className="w-28 px-3 py-2 text-right font-medium">Unscheduled</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2"><Avatar user={r.user} /> <span className="truncate">{r.user.name}</span></div>
                  <div className="pl-8 text-[11px] text-muted">{r.weekly}h/week{r.noEstimate > 0 && ` · ${r.noEstimate} task${r.noEstimate > 1 ? "s" : ""} without estimates`}</div>
                </td>
                {r.cells.map((c) => (
                  <td key={c.week} className="p-1">
                    <button
                      onClick={() => setOpen({ userId: r.user.id, week: c.week })}
                      className={clsx("w-full rounded-lg px-2 py-2 text-center text-xs transition-shadow hover:ring-2 hover:ring-brand", LOAD_STYLE[c.load], open?.userId === r.user.id && open.week === c.week && "ring-2 ring-brand")}
                    >
                      <div className="text-sm">{h(c.planned)}</div>
                      <div className="opacity-75">of {h(c.available)}{c.leaveDays > 0 && ` · ${c.leaveDays}d leave`}</div>
                    </button>
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-xs text-muted">{r.unscheduled ? h(r.unscheduled) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
        {(["light", "healthy", "busy", "over"] as Load[]).map((l) => <span key={l} className={clsx("rounded px-2 py-0.5", LOAD_STYLE[l])}>{{ light: "Under 50%", healthy: "50–85%", busy: "85–105%", over: "Over 105%" }[l as "light"]}</span>)}
        <span>Planned hours come from task estimates, spread over each task&apos;s start-to-due dates. Overdue work counts in this week.</span>
      </div>

      {selected && person && (
        <div className="mt-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm font-semibold">{person.name} · week of {weeks.find((w) => w.start === selected.week)?.label} · {h(selected.planned)} planned of {h(selected.available)}</div>
            <button onClick={() => setOpen(null)} className="text-muted hover:text-foreground" aria-label="Close"><X size={16} /></button>
          </div>
          <div className="divide-y divide-border">
            {selected.tasks.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                <Link href={`/tasks?task=${t.id}`} className="min-w-0 flex-1 truncate hover:text-brand">{t.title} <span className="text-xs text-muted">· {t.where}</span></Link>
                <span className="w-24 text-xs text-muted">{t.due ? `due ${t.due}` : ""}</span>
                <span className="w-14 text-right text-xs">{h(t.hours)}</span>
                {canReassign && (
                  <select value={person.id} disabled={pending} onChange={(e) => run(() => updateTask(t.id, { assigneeId: e.target.value }))} className={`${inputBase} py-1 text-xs`} aria-label="Reassign">
                    {staff.map((u) => <option key={u.id} value={u.id}>{u.id === person.id ? `${u.name} (current)` : `Move to ${u.name}`}</option>)}
                  </select>
                )}
              </div>
            ))}
            {!selected.tasks.length && <p className="px-4 py-6 text-center text-sm text-muted">No estimated work planned this week.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const LEAVE_LABELS: Record<LeaveType, string> = { ANNUAL: "Annual", SICK: "Sick", FAMILY: "Family responsibility", STUDY: "Study", OTHER: "Other" };

export function LeavePanel({ leave, staff, me, canManage, holidays }: { leave: { id: string; user: { id: string; name: string }; type: LeaveType; range: string; halfDay: boolean; note: string | null }[]; staff: { id: string; name: string }[]; me: string; canManage: boolean; holidays: { date: string; label: string; name: string }[] }) {
  const { run, pending, toast } = useAction();
  const [n, setN] = useState(0);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {toast}
      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Leave</div>
        <form
          key={n}
          action={(fd) =>
            run(
              () =>
                addLeave({
                  userId: String(fd.get("userId") ?? me),
                  type: fd.get("type") as LeaveType,
                  startDate: String(fd.get("startDate")),
                  endDate: String(fd.get("endDate") || fd.get("startDate")),
                  halfDay: fd.get("halfDay") === "on",
                  note: String(fd.get("note") ?? "") || null,
                }),
              () => setN((x) => x + 1),
            )
          }
          className="grid gap-2 border-b border-border p-4 sm:grid-cols-[1fr_1fr_130px_130px_auto] sm:items-end"
        >
          {canManage ? (
            <label className="text-xs font-medium text-muted">Who<select name="userId" defaultValue={me} className={`${inputClass} mt-1`}>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          ) : (
            <input type="hidden" name="userId" value={me} />
          )}
          <label className="text-xs font-medium text-muted">Type<select name="type" className={`${inputClass} mt-1`}>{Object.entries(LEAVE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="text-xs font-medium text-muted">From<input type="date" name="startDate" required className={`${inputClass} mt-1`} /></label>
          <label className="text-xs font-medium text-muted">To<input type="date" name="endDate" className={`${inputClass} mt-1`} /></label>
          <Button disabled={pending}>Add leave</Button>
          <label className="flex items-center gap-1.5 text-xs text-muted sm:col-span-2"><input type="checkbox" name="halfDay" /> Half day</label>
          <input name="note" placeholder="Note (optional)" className={`${inputClass} sm:col-span-3`} />
        </form>
        <div className="divide-y divide-border">
          {leave.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <Avatar user={l.user} size="xs" />
              <span className="w-40 truncate">{l.user.name}</span>
              <span className="flex-1 text-muted">{l.range}{l.halfDay && " (half day)"} · {LEAVE_LABELS[l.type]}{l.note && ` · ${l.note}`}</span>
              {(canManage || l.user.id === me) && <button onClick={() => confirm("Remove this leave?") && run(() => deleteLeave(l.id))} className="text-muted hover:text-danger" aria-label="Remove leave"><Trash2 size={14} /></button>}
            </div>
          ))}
          {!leave.length && <p className="px-4 py-6 text-center text-sm text-muted">No upcoming leave.</p>}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Upcoming public holidays</div>
        <ul className="divide-y divide-border text-sm">
          {holidays.map((x) => <li key={x.date} className="flex justify-between gap-2 px-4 py-2"><span>{x.name}</span><span className="text-muted">{x.label}</span></li>)}
        </ul>
      </div>
    </div>
  );
}
