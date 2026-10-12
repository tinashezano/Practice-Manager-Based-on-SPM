import clsx from "clsx";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { RandBars, RevenueSplit, RevenueTrend } from "@/components/dashboard/charts-client";
import { Kpi, PeriodFilter, SectionTitle } from "@/components/dashboard/kpi";
import { Badge, Card, PageHeader } from "@/components/ui";
import { addDays, formatDate, formatDateTime, parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { availableTeamHours, pct, revenue, sum, timeEntries, wip } from "@/lib/metrics";
import { formatRand } from "@/lib/money";
import { PERIODS, resolvePeriod } from "@/lib/periods";
import { requirePermission } from "@/lib/session";
import { STATUS_META } from "@/lib/task-meta";
import { buildPlanner } from "@/lib/workload";

export const metadata = { title: "Practice Dashboard" };
export const dynamic = "force-dynamic";

const R = (c: number) => formatRand(c).replace(/\.\d\d$/, "");
const signed = (n: number, unit = "%") => `${n > 0 ? "+" : ""}${n}${unit}`;

export default async function PracticeDashboard({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requirePermission("financials.view");
  const period = resolvePeriod((await searchParams).period);
  const today = todayISO();

  const [rev, revPrev, time, timePrev, avail, availPrev, wipBuckets, overdue, openTasks, planner, subs, services] = await Promise.all([
    revenue(period.from, period.to),
    revenue(period.prevFrom, period.prevTo),
    timeEntries(period.from, period.to),
    timeEntries(period.prevFrom, period.prevTo),
    availableTeamHours(period.from, period.to),
    availableTeamHours(period.prevFrom, period.prevTo),
    wip(),
    db.task.findMany({ where: { parentId: null, status: { not: "DONE" }, dueDate: { lt: parseISODate(today)! } }, select: { clientId: true, projectId: true } }),
    db.task.groupBy({ by: ["status"], where: { parentId: null, status: { not: "DONE" } }, _count: true }),
    buildPlanner({ weeks: 1 }),
    db.subscription.findMany({ where: { status: "ACTIVE" }, select: { amountCents: true, proposal: { select: { vatRatePercent: true } } } }),
    db.project.groupBy({ by: ["name"], where: { status: "ACTIVE" }, _count: true }),
  ]);

  // Headline figures
  const revenueTotal = sum(rev, (r) => r.recurring + r.onceOff);
  const revenuePrev = sum(revPrev, (r) => r.recurring + r.onceOff);
  const workValue = sum(time, (t) => t.value);
  const workPrev = sum(timePrev, (t) => t.value);
  const cost = sum(time, (t) => t.cost);
  const costPrev = sum(timePrev, (t) => t.cost);
  const billableH = sum(time.filter((t) => t.billable), (t) => t.minutes) / 60;
  const billablePrevH = sum(timePrev.filter((t) => t.billable), (t) => t.minutes) / 60;
  const util = avail ? Math.round((billableH / avail) * 100) : 0;
  const utilPrev = availPrev ? Math.round((billablePrevH / availPrev) * 100) : 0;
  const realisation = pct(revenueTotal, workValue);
  const realisationPrev = pct(revenuePrev, workPrev);
  const margin = revenueTotal ? Math.round(((revenueTotal - cost) / revenueTotal) * 100) : 0;
  const marginPrev = revenuePrev ? Math.round(((revenuePrev - costPrev) / revenuePrev) * 100) : 0;
  const wipTotal = sum(wipBuckets, (b) => b.value);
  const wipAtRisk = wipBuckets.filter((b) => b.tone !== "neutral");
  const overdueClients = new Set(overdue.map((o) => o.clientId).filter(Boolean)).size;
  const week = planner.rows.map((r) => r.cells[0]!);
  const capacityLeft = Math.round(sum(week, (c) => c.available) - sum(week, (c) => c.planned));
  const mrr = sum(subs, (s) => Math.round((s.amountCents * 100) / (100 + s.proposal.vatRatePercent)));
  const revDelta = revenuePrev ? Math.round(((revenueTotal - revenuePrev) / revenuePrev) * 100) : null;

  // Trend: cumulative revenue and work value per day (per week for long periods)
  const days: string[] = [];
  for (let d = period.from; d <= period.to; d = addDays(d, 1)) days.push(d);
  const step = days.length > 62 ? 7 : 1;
  const points = days.filter((_, i) => i % step === 0 || i === days.length - 1);
  const cumulative = (rows: { date: string; v: number }[]) => points.map((p) => sum(rows.filter((r) => r.date <= p), (r) => r.v));
  const revSeries = cumulative(rev.map((r) => ({ date: r.date, v: r.recurring + r.onceOff })));
  const workSeries = cumulative(time.map((t) => ({ date: t.date, v: t.value })));
  const tickEvery = Math.max(1, Math.round(points.length / 4));

  // Revenue split and top clients
  const recurring = sum(rev, (r) => r.recurring);
  const onceOff = sum(rev, (r) => r.onceOff);
  const byClient = new Map<string, number>();
  for (const r of rev) byClient.set(r.client, (byClient.get(r.client) ?? 0) + r.recurring + r.onceOff);
  const topClients = [...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Profitability by service (revenue by proposal line, time by project of the same name)
  const svc = new Map<string, { revenue: number; prevRevenue: number; value: number; cost: number; prevCost: number }>();
  const get = (name: string) => svc.get(name) ?? (svc.set(name, { revenue: 0, prevRevenue: 0, value: 0, cost: 0, prevCost: 0 }), svc.get(name)!);
  for (const r of rev) for (const [name, v] of r.byService) get(name).revenue += v;
  for (const r of revPrev) for (const [name, v] of r.byService) get(name).prevRevenue += v;
  for (const t of time) if (t.project && svc.has(t.project)) { get(t.project).value += t.value; get(t.project).cost += t.cost; }
  for (const t of timePrev) if (t.project && svc.has(t.project)) get(t.project).prevCost += t.cost;
  const svcRows = [...svc.entries()].filter(([, v]) => v.revenue > 0 || v.cost > 0).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8);
  const jobsByName = new Map(services.map((s) => [s.name, s._count]));

  // Workflow
  const statusCount = (s: TaskStatus) => openTasks.find((o) => o.status === s)?._count ?? 0;
  const atRiskProjects = await db.project.findMany({
    where: { id: { in: [...new Set(overdue.map((o) => o.projectId).filter((x): x is string => !!x))] } },
    include: { client: { select: { id: true, name: true } }, _count: { select: { tasks: { where: { status: { not: "DONE" }, dueDate: { lt: parseISODate(today)! }, parentId: null } } } } },
    take: 6,
  });

  return (
    <>
      <PageHeader
        title="Practice Dashboard"
        subtitle={`${period.label}: ${formatDate(period.from, { day: "numeric", month: "short" })} – ${formatDate(period.to, { day: "numeric", month: "short", year: "numeric" })}. Arrows compare with ${formatDate(period.prevFrom, { day: "numeric", month: "short" })} – ${formatDate(period.prevTo, { day: "numeric", month: "short" })}. Updated ${formatDateTime(new Date())}.`}
        actions={
          <div className="flex items-center gap-2">
            <PeriodFilter period={period.key} options={PERIODS} action="/overview/practice" />
            <Link href={`/overview/practice?period=${period.key}`} className="rounded-lg border border-border bg-surface p-2 hover:bg-background" aria-label="Refresh"><RefreshCw size={15} /></Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Revenue" value={R(revenueTotal)} delta={revDelta === null ? null : signed(revDelta)} good={revDelta === null ? null : revDelta >= 0} hint={`Excl. VAT · MRR ${R(mrr)}`} />
        <Kpi label="Margin" value={revenueTotal ? `${margin}%` : "—"} delta={revenueTotal && revenuePrev ? signed(margin - marginPrev, " pts") : null} good={margin >= marginPrev} hint={`After staff time cost of ${R(cost)}`} />
        <Kpi label="Utilisation" value={`${util}%`} delta={availPrev && billablePrevH ? signed(util - utilPrev, " pts") : null} good={util >= utilPrev} hint={`${Math.round(billableH)}h billable of ${Math.round(avail)}h`} />
        <Kpi label="Realisation" value={workValue ? `${realisation}%` : "—"} delta={workValue && workPrev ? signed(realisation - realisationPrev, " pts") : null} good={realisation >= realisationPrev} hint="Revenue ÷ work value" />
        <Kpi label="WIP value" value={R(wipTotal)} hint={`${sum(wipAtRisk, (b) => b.jobs)} jobs over 60 days`} alert={sum(wipAtRisk, (b) => b.value) > 0} />
        <Kpi label="Jobs overdue" value={overdue.length} hint={`${overdueClients} client${overdueClients === 1 ? "" : "s"} affected`} alert={overdue.length > 0} />
        <Kpi label="Available capacity" value={`${capacityLeft}h`} hint="Unplanned hours this week" alert={capacityLeft < 0} />
      </div>

      <SectionTitle title="Financial health" subtitle="Revenue is payments received (Paystack and recorded EFTs), excluding VAT. Work value is billable time at each person's billing rate." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Revenue trend <span className="font-normal text-muted">(cumulative)</span></h3>
          <RevenueTrend
            labels={points.map((p) => formatDate(p, { day: "numeric", month: "short" }))}
            tickLabels={points.map((p, i) => (i % tickEvery === 0 || i === points.length - 1 ? formatDate(p, { day: "numeric", month: "short" }) : ""))}
            revenue={revSeries}
            work={workSeries}
          />
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">WIP ageing</h3>
            <span className="text-xs text-muted">Unbilled billable work on unfinished tasks, by age</span>
          </div>
          <RandBars ordinal rows={wipBuckets.map((b) => ({ label: b.label, value: b.value, note: `${b.jobs} job${b.jobs === 1 ? "" : "s"}${b.tone === "warning" ? " · watch" : b.tone === "danger" ? " · high risk" : ""}` }))} />
          <p className="mt-3 text-xs text-muted">Total {R(wipTotal)}. Work in the older buckets usually means a job is stuck or not being billed.</p>
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Revenue split</h3>
          <RevenueSplit recurring={recurring} onceOff={onceOff} recurringSub={`${subs.length} active retainer${subs.length === 1 ? "" : "s"} · MRR ${R(mrr)}`} onceOffSub={`${rev.filter((r) => r.onceOff > 0).length} once-off payment${rev.filter((r) => r.onceOff > 0).length === 1 ? "" : "s"}`} />
          <h4 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted">Top clients this period</h4>
          {topClients.length ? <RandBars rows={topClients.map(([label, value]) => ({ label, value }))} /> : <p className="py-6 text-center text-sm text-muted">No payments received in this period.</p>}
        </Card>
        <Card className="overflow-x-auto">
          <h3 className="mb-3 text-sm font-semibold">Profitability by service</h3>
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-2 font-medium">Service</th>
                <th className="py-2 text-right font-medium">Revenue</th>
                <th className="py-2 text-right font-medium">Staff cost</th>
                <th className="py-2 text-right font-medium">Profit</th>
                <th className="py-2 text-right font-medium">Margin</th>
                <th className="py-2 text-right font-medium">Jobs</th>
              </tr>
            </thead>
            <tbody>
              {svcRows.map(([name, v]) => {
                const profit = v.revenue - v.cost;
                const m = v.revenue ? Math.round((profit / v.revenue) * 100) : null;
                const prevM = v.prevRevenue ? Math.round(((v.prevRevenue - v.prevCost) / v.prevRevenue) * 100) : null;
                return (
                  <tr key={name} className="border-b border-border last:border-0">
                    <td className="py-2">{name}</td>
                    <td className="py-2 text-right tabular-nums">{R(v.revenue)}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{R(v.cost)}</td>
                    <td className={clsx("py-2 text-right tabular-nums", profit < 0 && "text-danger")}>{R(profit)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {m === null ? "—" : `${m}%`}
                      {m !== null && prevM !== null && m !== prevM && (m > prevM ? <ArrowUpRight size={12} className="ml-0.5 inline text-success" /> : <ArrowDownRight size={12} className="ml-0.5 inline text-danger" />)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted">{jobsByName.get(name) ?? 0}</td>
                  </tr>
                );
              })}
              {!svcRows.length && <tr><td colSpan={6} className="py-8 text-center text-muted">No revenue or costed time in this period.</td></tr>}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">Revenue is allocated to the services on each paid proposal. Staff cost is time logged on projects of the same name at cost rates.</p>
        </Card>
      </div>

      <SectionTitle title="Workflow & jobs" subtitle="Where open work sits right now, and which projects are running late." />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Job status pipeline</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["TODO", "IN_PROGRESS", "WAITING_ON_CLIENT", "IN_REVIEW"] as TaskStatus[]).map((s) => (
              <Link key={s} href={`/tasks?view=board`} className="rounded-lg border border-border p-3 hover:border-brand">
                <div className="flex items-center gap-1.5 text-xs text-muted"><span className={clsx("h-2 w-2 rounded-full", STATUS_META[s].dot)} /> {STATUS_META[s].label}</div>
                <div className="mt-1 text-2xl font-semibold">{statusCount(s)}</div>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Projects running late</h3>
          <ul className="divide-y divide-border">
            {atRiskProjects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <Link href={`/clients/${p.client.id}?project=${p.id}`} className="min-w-0 truncate hover:text-brand">{p.name} <span className="text-xs text-muted">· {p.client.name}</span></Link>
                <span className="shrink-0 whitespace-nowrap"><Badge tone="danger">{p._count.tasks} overdue</Badge></span>
              </li>
            ))}
            {!atRiskProjects.length && <li className="py-6 text-center text-sm text-muted">No projects with overdue tasks.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
