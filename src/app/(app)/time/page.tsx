import clsx from "clsx";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { availableHours } from "@/lib/capacity";
import { addDays, formatDate, parseISODate, startOfWeek, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { holidayMap } from "@/lib/holidays";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { taskHome } from "@/lib/task-meta";
import { formatMinutes } from "@/lib/time-format";
import { AddEntry, EntryRow } from "./controls";

export const metadata = { title: "Time Tracker" };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function TimePage({ searchParams }: { searchParams: Promise<{ week?: string; user?: string }> }) {
  const me = await requirePermission("tasks.work");
  const sp = await searchParams;
  const viewAll = can(me.role, "workload.viewAll");
  const userId = viewAll && sp.user ? sp.user : me.id;
  const today = todayISO();
  const week = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? startOfWeek(sp.week) : startOfWeek(today);
  const weekEnd = addDays(week, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  const [person, entries, staff, myTasks, clients, leave] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, weeklyCapacityHours: true, billableTargetPercent: true } }),
    db.timeEntry.findMany({
      where: { userId, date: { gte: parseISODate(week)!, lte: parseISODate(weekEnd)! } },
      include: { task: { select: { id: true, title: true, client: { select: { id: true, name: true } }, deal: { select: { id: true, name: true } } } }, client: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    viewAll ? db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    db.task.findMany({
      where: { assigneeId: userId, status: { not: "DONE" } },
      select: { id: true, title: true, client: { select: { id: true, name: true } }, deal: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      take: 200,
    }),
    db.client.findMany({ where: { status: { not: "INACTIVE" } }, select: { id: true, name: true }, orderBy: [{ isInternal: "desc" }, { name: "asc" }] }),
    db.leave.findMany({ where: { userId, endDate: { gte: parseISODate(week)! }, startDate: { lte: parseISODate(weekEnd)! } } }),
  ]);

  const total = entries.reduce((n, e) => n + e.minutes, 0);
  const billable = entries.filter((e) => e.billable).reduce((n, e) => n + e.minutes, 0);
  const available = availableHours(
    person.weeklyCapacityHours,
    week,
    holidayMap(week, weekEnd),
    leave.map((l) => ({ startDate: l.startDate.toISOString().slice(0, 10), endDate: l.endDate.toISOString().slice(0, 10), halfDay: l.halfDay })),
  );
  const billablePct = total ? Math.round((billable / total) * 100) : 0;
  const utilisation = available ? Math.round((billable / 60 / available) * 100) : 0;

  // Grid rows: one per task (or per client for general time).
  const rows = new Map<string, { label: string; sub: string; perDay: number[] }>();
  for (const e of entries) {
    const key = e.taskId ?? `c:${e.clientId}`;
    const label = e.task?.title ?? "General time";
    const sub = e.task ? taskHome(e.task).name : e.client?.name ?? "No client";
    const row = rows.get(key) ?? { label, sub, perDay: Array(7).fill(0) };
    row.perDay[days.indexOf(e.date.toISOString().slice(0, 10))]! += e.minutes;
    rows.set(key, row);
  }
  const dayTotals = days.map((_, i) => [...rows.values()].reduce((n, r) => n + r.perDay[i]!, 0));
  const editable = userId === me.id || can(me.role, "tasks.manageAll");
  const href = (p: Record<string, string>) => `/time?${new URLSearchParams({ ...(userId !== me.id ? { user: userId } : {}), week, ...p })}`;

  return (
    <>
      <PageHeader
        title="Time Tracker"
        subtitle={userId === me.id ? "Your timesheet. Start timers from any task, or add time here." : `${person.name}'s timesheet`}
        actions={
          viewAll && (
            <form className="flex gap-2">
              <input type="hidden" name="week" value={week} />
              <select name="user" defaultValue={userId} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-background">View</button>
            </form>
          )
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Link href={href({ week: addDays(week, -7) })} className="rounded-lg border border-border p-1.5 hover:bg-surface" aria-label="Previous week"><ChevronLeft size={16} /></Link>
        <span className="text-sm font-medium">{formatDate(week, { day: "numeric", month: "short" })} – {formatDate(weekEnd, { day: "numeric", month: "short", year: "numeric" })}</span>
        <Link href={href({ week: addDays(week, 7) })} className="rounded-lg border border-border p-1.5 hover:bg-surface" aria-label="Next week"><ChevronRight size={16} /></Link>
        {week !== startOfWeek(today) && <Link href={href({ week: startOfWeek(today) })} className="text-sm text-brand">This week</Link>}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Logged" value={formatMinutes(total)} hint={`of ${Math.round(available * 10) / 10}h available this week`} />
        <StatCard label="Billable" value={formatMinutes(billable)} hint={`${billablePct}% of logged time`} />
        <StatCard label="Utilisation" value={<span className={utilisation >= person.billableTargetPercent ? "text-success" : ""}>{utilisation}%</span>} hint={`Billable ÷ available · target ${person.billableTargetPercent}%`} />
        <StatCard label="Non-billable" value={formatMinutes(total - billable)} hint="Admin, internal, leads" />
      </div>

      {editable && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold">Add time</h2>
          <AddEntry
            userId={userId}
            defaultDate={today >= week && today <= weekEnd ? today : week}
            tasks={myTasks.map((t) => ({ id: t.id, title: t.title, group: taskHome(t).name }))}
            clients={clients}
          />
        </Card>
      )}

      <Card className="mb-6 overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="px-4 py-2 text-left font-medium">Task</th>
              {days.map((d, i) => <th key={d} className={clsx("w-16 px-2 py-2 text-right font-medium", d === today && "text-brand")}>{DAYS[i]} {Number(d.slice(8))}</th>)}
              <th className="w-20 px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...rows.entries()].map(([k, r]) => (
              <tr key={k} className="border-b border-border">
                <td className="px-4 py-2"><div className="truncate">{r.label}</div><div className="truncate text-xs text-muted">{r.sub}</div></td>
                {r.perDay.map((m, i) => <td key={i} className={clsx("px-2 py-2 text-right", !m && "text-border")}>{m ? formatMinutes(m) : "·"}</td>)}
                <td className="px-4 py-2 text-right font-medium">{formatMinutes(r.perDay.reduce((a, b) => a + b, 0))}</td>
              </tr>
            ))}
            {!rows.size && <tr><td colSpan={9} className="py-10 text-center text-muted">No time logged this week.</td></tr>}
          </tbody>
          {rows.size > 0 && (
            <tfoot>
              <tr className="text-xs font-medium">
                <td className="px-4 py-2 text-muted">Day total</td>
                {dayTotals.map((m, i) => <td key={i} className="px-2 py-2 text-right">{m ? formatMinutes(m) : ""}</td>)}
                <td className="px-4 py-2 text-right">{formatMinutes(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>

      <Card className="divide-y divide-border p-0">
        <div className="px-4 py-3 text-sm font-semibold">Entries</div>
        {entries.map((e) => (
          <EntryRow
            key={e.id}
            editable={editable}
            e={{
              id: e.id,
              date: e.date.toISOString().slice(0, 10),
              dateLabel: formatDate(e.date, { weekday: "short", day: "numeric" }),
              label: e.task?.title ?? "General time",
              sub: e.task ? taskHome(e.task).name : e.client?.name ?? "",
              minutes: e.minutes,
              billable: e.billable,
              description: e.description,
              running: e.running,
            }}
          />
        ))}
        {!entries.length && <p className="px-4 py-6 text-center text-sm text-muted">Nothing yet.</p>}
      </Card>
    </>
  );
}
