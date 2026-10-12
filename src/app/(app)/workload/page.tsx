import { PageHeader, StatCard } from "@/components/ui";
import { availableHours, loadLevel, spreadTask } from "@/lib/capacity";
import { addDays, formatDate, parseISODate, startOfWeek, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { holidayMap, saHolidays } from "@/lib/holidays";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { taskHome } from "@/lib/task-meta";
import { LeavePanel, Planner, type Row } from "./planner";

export const metadata = { title: "Workload" };

const WEEKS = 6;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function WorkloadPage() {
  const me = await requirePermission("tasks.work");
  const viewAll = can(me.role, "workload.viewAll");
  const today = todayISO();
  const first = startOfWeek(today);
  const last = addDays(first, WEEKS * 7 - 1);
  const weekStarts = Array.from({ length: WEEKS }, (_, i) => addDays(first, i * 7));
  const holidays = holidayMap(first, last);

  const [users, tasks, leave] = await Promise.all([
    db.user.findMany({ where: { active: true, ...(viewAll ? {} : { id: me.id }) }, select: { id: true, name: true, weeklyCapacityHours: true }, orderBy: { name: "asc" } }),
    db.task.findMany({
      where: { status: { not: "DONE" }, assigneeId: viewAll ? { not: null } : me.id },
      select: { id: true, title: true, assigneeId: true, estimateMinutes: true, startDate: true, dueDate: true, client: { select: { id: true, name: true } }, deal: { select: { id: true, name: true } } },
    }),
    db.leave.findMany({ where: { endDate: { gte: parseISODate(first)! }, ...(viewAll ? {} : { userId: me.id }) }, include: { user: { select: { id: true, name: true } } }, orderBy: { startDate: "asc" } }),
  ]);

  const rows: Row[] = users.map((u) => {
    const myLeave = leave.filter((l) => l.userId === u.id).map((l) => ({ startDate: iso(l.startDate), endDate: iso(l.endDate), halfDay: l.halfDay }));
    const cells = weekStarts.map((w) => {
      const leaveDays = Array.from({ length: 5 }, (_, i) => addDays(w, i)).filter((d) => !holidays.has(d) && myLeave.some((l) => d >= l.startDate && d <= l.endDate)).length;
      return { week: w, planned: 0, available: availableHours(u.weeklyCapacityHours, w, holidays, myLeave), load: "none" as Row["cells"][number]["load"], tasks: [] as Row["cells"][number]["tasks"], leaveDays };
    });
    let unscheduled = 0;
    let noEstimate = 0;
    for (const t of tasks.filter((x) => x.assigneeId === u.id)) {
      if (!t.estimateMinutes) {
        noEstimate++;
        continue;
      }
      const s = spreadTask({ id: t.id, estimateMinutes: t.estimateMinutes, startDate: t.startDate ? iso(t.startDate) : null, dueDate: t.dueDate ? iso(t.dueDate) : null }, today, holidays);
      unscheduled += s.unscheduled;
      for (const [w, hours] of s.weeks) {
        const cell = cells.find((c) => c.week === w);
        if (!cell) continue;
        cell.planned += hours;
        cell.tasks.push({ id: t.id, title: t.title, where: taskHome(t).name, hours, due: t.dueDate ? formatDate(t.dueDate) : null });
      }
    }
    for (const c of cells) {
      c.load = loadLevel(c.planned, c.available);
      c.tasks.sort((a, b) => b.hours - a.hours);
    }
    return { user: { id: u.id, name: u.name }, weekly: u.weeklyCapacityHours, cells, unscheduled, noEstimate };
  });

  const thisWeek = rows.map((r) => r.cells[0]!);
  const overloaded = rows.filter((r) => r.cells.some((c) => c.load === "over")).length;
  const planned = thisWeek.reduce((n, c) => n + c.planned, 0);
  const available = thisWeek.reduce((n, c) => n + c.available, 0);
  const upcomingHolidays = [...saHolidays(Number(today.slice(0, 4))), ...saHolidays(Number(today.slice(0, 4)) + 1)].filter((x) => x.date >= today).slice(0, 8);

  return (
    <>
      <PageHeader title="Workload" subtitle={viewAll ? "Planned work against available hours for the next six weeks. Click a week to see the work and rebalance it." : "Your planned work against your available hours."} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Planned this week" value={`${Math.round(planned)}h`} hint={`of ${Math.round(available)}h available`} />
        <StatCard label="Team load this week" value={`${available ? Math.round((planned / available) * 100) : 0}%`} />
        <StatCard label="People overloaded" value={<span className={overloaded ? "text-danger" : ""}>{overloaded}</span>} hint="In any of the next 6 weeks" />
        <StatCard label="Tasks without estimates" value={rows.reduce((n, r) => n + r.noEstimate, 0)} hint="Add estimates so they count" />
      </div>
      <Planner
        rows={rows}
        weeks={weekStarts.map((w) => ({
          start: w,
          label: formatDate(w, { day: "numeric", month: "short" }),
          holidays: Array.from({ length: 5 }, (_, i) => addDays(w, i)).filter((d) => holidays.has(d)).map((d) => holidays.get(d)!),
        }))}
        staff={viewAll ? users.map((u) => ({ id: u.id, name: u.name })) : []}
        canReassign={can(me.role, "tasks.manageAll")}
      />
      <div className="mt-8">
        <LeavePanel
          me={me.id}
          canManage={can(me.role, "team.manage")}
          staff={users.map((u) => ({ id: u.id, name: u.name }))}
          leave={leave.map((l) => ({
            id: l.id,
            user: l.user,
            type: l.type,
            halfDay: l.halfDay,
            note: l.note,
            range: iso(l.startDate) === iso(l.endDate) ? formatDate(l.startDate, { weekday: "short", day: "numeric", month: "short" }) : `${formatDate(l.startDate, { day: "numeric", month: "short" })} – ${formatDate(l.endDate, { day: "numeric", month: "short", year: "numeric" })}`,
          }))}
          holidays={upcomingHolidays.map((x) => ({ date: x.date, name: x.name, label: formatDate(x.date, { weekday: "short", day: "numeric", month: "short" }) }))}
        />
      </div>
    </>
  );
}
