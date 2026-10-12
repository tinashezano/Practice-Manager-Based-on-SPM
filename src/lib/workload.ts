import { availableHours, loadLevel, spreadTask, type Load } from "@/lib/capacity";
import { addDays, formatDate, parseISODate, startOfWeek, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { holidayMap } from "@/lib/holidays";
import { taskHome } from "@/lib/task-meta";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export type PlannerCell = { week: string; planned: number; available: number; load: Load; tasks: { id: string; title: string; where: string; hours: number; due: string | null }[]; leaveDays: number };
export type PlannerRow = { user: { id: string; name: string }; weekly: number; cells: PlannerCell[]; unscheduled: number; noEstimate: number };

/** Planned vs available hours per person per week (shared by Workload and the dashboards). */
export async function buildPlanner(opts: { weeks: number; userIds?: string[] }) {
  const today = todayISO();
  const first = startOfWeek(today);
  const last = addDays(first, opts.weeks * 7 - 1);
  const weekStarts = Array.from({ length: opts.weeks }, (_, i) => addDays(first, i * 7));
  const holidays = holidayMap(first, last);
  const userFilter = opts.userIds ? { id: { in: opts.userIds } } : {};

  const [users, tasks, leave] = await Promise.all([
    db.user.findMany({ where: { active: true, ...userFilter }, select: { id: true, name: true, weeklyCapacityHours: true }, orderBy: { name: "asc" } }),
    db.task.findMany({
      where: { status: { not: "DONE" }, assigneeId: opts.userIds ? { in: opts.userIds } : { not: null } },
      select: { id: true, title: true, assigneeId: true, estimateMinutes: true, startDate: true, dueDate: true, client: { select: { id: true, name: true } }, deal: { select: { id: true, name: true } } },
    }),
    db.leave.findMany({ where: { endDate: { gte: parseISODate(first)! }, ...(opts.userIds ? { userId: { in: opts.userIds } } : {}) }, include: { user: { select: { id: true, name: true } } }, orderBy: { startDate: "asc" } }),
  ]);

  const rows: PlannerRow[] = users.map((u) => {
    const myLeave = leave.filter((l) => l.userId === u.id).map((l) => ({ startDate: iso(l.startDate), endDate: iso(l.endDate), halfDay: l.halfDay }));
    const cells: PlannerCell[] = weekStarts.map((w) => ({
      week: w,
      planned: 0,
      available: availableHours(u.weeklyCapacityHours, w, holidays, myLeave),
      load: "none",
      tasks: [],
      leaveDays: Array.from({ length: 5 }, (_, i) => addDays(w, i)).filter((d) => !holidays.has(d) && myLeave.some((l) => d >= l.startDate && d <= l.endDate)).length,
    }));
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

  return { rows, weekStarts, holidays, leave, users, today };
}
