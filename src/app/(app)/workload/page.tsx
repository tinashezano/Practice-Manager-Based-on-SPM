import { PageHeader, StatCard } from "@/components/ui";
import { addDays, formatDate } from "@/lib/dates";
import { saHolidays } from "@/lib/holidays";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { buildPlanner } from "@/lib/workload";
import { LeavePanel, Planner } from "./planner";

export const metadata = { title: "Workload" };

const WEEKS = 6;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function WorkloadPage() {
  const me = await requirePermission("tasks.work");
  const viewAll = can(me.role, "workload.viewAll");
  const { rows, weekStarts, holidays, leave, users, today } = await buildPlanner({ weeks: WEEKS, userIds: viewAll ? undefined : [me.id] });
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
