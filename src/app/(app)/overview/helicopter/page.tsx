import clsx from "clsx";
import Link from "next/link";
import { AlertCircle, ArrowRight, ClipboardList, Clock, FileSignature, Gauge, Hourglass, Lightbulb, ShieldAlert, Sparkles, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Kpi, SectionTitle } from "@/components/dashboard/kpi";
import { Card, PageHeader } from "@/components/ui";
import { addDays, formatDateTime, parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { availableTeamHours, revenue, sum, wip } from "@/lib/metrics";
import { formatRand } from "@/lib/money";
import { requirePermission } from "@/lib/session";
import { buildPlanner } from "@/lib/workload";

export const metadata = { title: "Helicopter View" };
export const dynamic = "force-dynamic";

const R = (c: number) => formatRand(c).replace(/\.\d\d$/, "");
const daysSince = (d: Date, today: string) => Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(d.toISOString().slice(0, 10) + "T00:00:00Z")) / 86_400_000);

function topOwner(ids: (string | null | undefined)[]) {
  const counts = new Map<string, number>();
  for (const id of ids) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export default async function HelicopterView() {
  await requirePermission("financials.view");
  const today = todayISO();
  const todayD = parseISODate(today)!;
  const in2 = parseISODate(addDays(today, 2))!;
  const monthFrom = `${today.slice(0, 7)}-01`;

  const [open, activeClients, planner, proposalsWaiting, signedUnpaid, pastDue, staleLeads, onboardingWaiting, wipBuckets, rev, avail, monthTime, completed30, opened30, onboardDone, users] = await Promise.all([
    db.task.findMany({
      where: { parentId: null, status: { not: "DONE" } },
      select: { id: true, title: true, status: true, dueDate: true, createdAt: true, assigneeId: true, reviewerId: true, updatedAt: true, clientId: true, client: { select: { name: true, isInternal: true } } },
    }),
    db.client.count({ where: { status: { in: ["ACTIVE", "ONBOARDING"] }, isInternal: false } }),
    buildPlanner({ weeks: 1 }),
    db.proposal.findMany({ where: { status: { in: ["SENT", "VIEWED"] }, sentAt: { lt: new Date(Date.now() - 5 * 86_400_000) }, validUntil: { gte: todayD } }, select: { onceOffExVat: true, onceOffVat: true, monthlyExVat: true, monthlyVat: true, deal: { select: { ownerId: true } } } }),
    db.proposal.count({ where: { status: "SIGNED", paidAt: null } }),
    db.subscription.count({ where: { status: "PAST_DUE" } }),
    db.deal.findMany({ where: { stage: "NEW_LEAD", createdAt: { lt: new Date(Date.now() - 3 * 86_400_000) } }, select: { ownerId: true } }),
    db.onboarding.findMany({ where: { stage: "INFO_REQUESTED", stageChangedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } }, select: { ownerId: true, client: { select: { name: true } } } }),
    wip(),
    revenue(monthFrom, today),
    availableTeamHours(monthFrom, today),
    db.timeEntry.aggregate({ where: { billable: true, running: false, date: { gte: parseISODate(monthFrom)! } }, _sum: { minutes: true } }),
    db.task.findMany({ where: { parentId: null, completedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, select: { createdAt: true, completedAt: true } }),
    db.task.count({ where: { parentId: null, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
    db.onboarding.findMany({ where: { completedAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }, select: { createdAt: true, completedAt: true } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);
  const userOf = new Map(users.map((u) => [u.id, u]));

  // Snapshot
  const overdue = open.filter((t) => t.dueDate && t.dueDate < todayD);
  const atRisk = open.filter((t) => t.dueDate && t.dueDate >= todayD && t.dueDate <= in2 && t.status === "TODO");
  const stale = open.filter((t) => t.status === "TODO" && daysSince(t.createdAt, today) > 10);
  const blocked = open.filter((t) => t.status === "WAITING_ON_CLIENT");
  const delayedClients = new Set(overdue.filter((t) => t.clientId && !t.client?.isInternal).map((t) => t.clientId));
  const avgDelay = overdue.length ? Math.round(sum(overdue, (t) => daysSince(t.dueDate!, today)) / overdue.length) : 0;
  const week = planner.rows.map((r) => ({ user: r.user, cell: r.cells[0]! }));
  const overloaded = week.filter((w) => w.cell.load === "over");
  const maxLoad = Math.max(0, ...week.map((w) => (w.cell.available ? w.cell.planned / w.cell.available : 0)));
  const overloadLevel = maxLoad > 1.05 ? "HIGH" : maxLoad > 0.85 ? "MEDIUM" : "LOW";
  const valueAtRisk = sum(wipBuckets.filter((b) => b.tone !== "neutral"), (b) => b.value);
  const old60 = open.filter((t) => daysSince(t.createdAt, today) > 60);

  // Insights (rule-based)
  const byClient = new Map<string, { name: string; count: number; oldest: number }>();
  for (const t of overdue) {
    if (!t.clientId || !t.client) continue;
    const e = byClient.get(t.clientId) ?? { name: t.client.name, count: 0, oldest: 0 };
    e.count++;
    e.oldest = Math.max(e.oldest, daysSince(t.dueDate!, today));
    byClient.set(t.clientId, e);
  }
  const worstClient = [...byClient.entries()].sort((a, b) => b[1].count - a[1].count || b[1].oldest - a[1].oldest)[0];
  const waitingValue = sum(proposalsWaiting, (p) => p.onceOffExVat + p.onceOffVat + p.monthlyExVat + p.monthlyVat);

  const insights = [
    { icon: AlertCircle, tone: "text-danger", title: "Immediate action", text: worstClient ? `${worstClient[1].name} has ${worstClient[1].count} overdue task${worstClient[1].count === 1 ? "" : "s"} (oldest ${worstClient[1].oldest} days late).` : "No overdue client work. Nice.", href: worstClient ? `/clients/${worstClient[0]}` : "/tasks" },
    { icon: ShieldAlert, tone: "text-warning", title: "Risk alert", text: `${old60.length} task${old60.length === 1 ? " has" : "s have"} been open for more than 60 days.`, href: "/tasks?view=board" },
    { icon: Lightbulb, tone: "text-success", title: "Suggested action", text: onboardingWaiting.length ? `Call ${onboardingWaiting.map((o) => o.client.name).slice(0, 2).join(" and ")}: onboarding information outstanding for over a week.` : "All new clients are sending their information on time.", href: "/clients/onboarding" },
    { icon: Users, tone: "text-warning", title: "Capacity warning", text: overloaded.length ? `${overloaded.map((o) => o.user.name.split(" ")[0]).join(", ")} ${overloaded.length === 1 ? "is" : "are"} over capacity this week.` : "Team capacity is within the normal range.", href: "/workload" },
    { icon: FileSignature, tone: "text-brand", title: "Pipeline note", text: `${proposalsWaiting.length} proposal${proposalsWaiting.length === 1 ? "" : "s"} waiting over 5 days (${R(waitingValue)} due on acceptance)${signedUnpaid ? `; ${signedUnpaid} signed but unpaid` : ""}.`, href: "/proposals?tab=awaiting" },
  ];

  // Today's management focus, ranked by weight × count
  const reviewBacklog = open.filter((t) => t.status === "IN_REVIEW");
  const focus = [
    { key: "overdue", icon: Clock, title: "Overdue work", reason: `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} across ${delayedClients.size} client${delayedClients.size === 1 ? "" : "s"}, average ${avgDelay} days late`, count: overdue.length, weight: 3, owner: topOwner(overdue.map((t) => t.assigneeId)), href: "/tasks" },
    { key: "review", icon: ClipboardList, title: "Review backlog", reason: `${reviewBacklog.length} task${reviewBacklog.length === 1 ? "" : "s"} waiting for review`, count: reviewBacklog.length, weight: 2.5, owner: topOwner(reviewBacklog.map((t) => t.reviewerId)), href: "/tasks?view=board" },
    { key: "waiting", icon: Hourglass, title: "Waiting on client", reason: `${blocked.length} task${blocked.length === 1 ? "" : "s"} blocked by missing information; ${onboardingWaiting.length} onboarding${onboardingWaiting.length === 1 ? "" : "s"} stalled 7+ days`, count: blocked.length + onboardingWaiting.length, weight: 2, owner: topOwner([...blocked.map((t) => t.assigneeId), ...onboardingWaiting.map((o) => o.ownerId)]), href: "/clients/onboarding" },
    { key: "capacity", icon: Gauge, title: "Capacity risk", reason: `${overloaded.length} ${overloaded.length === 1 ? "person" : "people"} over capacity this week`, count: overloaded.length, weight: 2, owner: overloaded.sort((a, b) => b.cell.planned / (b.cell.available || 1) - a.cell.planned / (a.cell.available || 1))[0]?.user.id ?? null, href: "/workload" },
    { key: "proposals", icon: FileSignature, title: "Proposal follow-up", reason: `${proposalsWaiting.length} proposal${proposalsWaiting.length === 1 ? "" : "s"} waiting 5+ days (${R(waitingValue)}), ${signedUnpaid} signed but unpaid`, count: proposalsWaiting.length + signedUnpaid, weight: 1.5, owner: topOwner(proposalsWaiting.map((p) => p.deal.ownerId)), href: "/proposals?tab=awaiting" },
    { key: "retainers", icon: AlertCircle, title: "Failed retainer payments", reason: `${pastDue} monthly retainer${pastDue === 1 ? "" : "s"} past due at Paystack`, count: pastDue, weight: 3, owner: null, href: "/proposals?tab=accepted" },
    { key: "leads", icon: Sparkles, title: "New leads not progressed", reason: `${staleLeads.length} lead${staleLeads.length === 1 ? "" : "s"} still at New lead after 3 days`, count: staleLeads.length, weight: 1, owner: topOwner(staleLeads.map((d) => d.ownerId)), href: "/deals/pipeline" },
  ]
    .map((f) => ({ ...f, score: f.count * f.weight }))
    .sort((a, b) => b.score - a.score);

  // Performance
  const revenueMtd = sum(rev, (r) => r.recurring + r.onceOff);
  const util = avail ? Math.round(((monthTime._sum.minutes ?? 0) / 60 / avail) * 100) : 0;
  const turnaround = completed30.length ? Math.round(sum(completed30, (t) => (t.completedAt!.getTime() - t.createdAt.getTime()) / 86_400_000) / completed30.length) : null;
  const onboardDays = onboardDone.length ? Math.round(sum(onboardDone, (o) => (o.completedAt!.getTime() - o.createdAt.getTime()) / 86_400_000) / onboardDone.length) : null;

  const tile = (label: string, value: React.ReactNode, hint: string, warn = false) => (
    <div className="border-border p-4 [&:not(:last-child)]:border-r">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={clsx("mt-1 text-2xl font-semibold tabular-nums", warn ? "text-warning" : "")}>{value}</div>
      <div className="text-xs text-muted">{hint}</div>
    </div>
  );

  return (
    <>
      <PageHeader title="Helicopter View" subtitle={`Daily operations at a glance · updated ${formatDateTime(new Date())}`} />

      <SectionTitle title="Operational snapshot" subtitle="Eight signals for the morning stand-up. Click through to act." />
      <Card className="grid grid-cols-2 p-0 md:grid-cols-4 xl:grid-cols-8">
        {tile("Tasks at risk", atRisk.length, "Due in 2 days, not started", atRisk.length > 0)}
        {tile("Overdue tasks", overdue.length, `${delayedClients.size} client${delayedClients.size === 1 ? "" : "s"} affected`, overdue.length > 0)}
        {tile("Open > 10 days", stale.length, "Not started yet", stale.length > 0)}
        {tile("Value at risk", R(valueAtRisk), "WIP older than 60 days", valueAtRisk > 0)}
        {tile("Clients with delays", delayedClients.size, `${activeClients ? Math.round((delayedClients.size / activeClients) * 100) : 0}% of active clients`, delayedClients.size > 0)}
        {tile("Team overload", <span className={overloadLevel === "HIGH" ? "text-danger" : overloadLevel === "MEDIUM" ? "text-warning" : "text-success"}>{overloadLevel}</span>, `Busiest at ${Math.round(maxLoad * 100)}% this week`)}
        {tile("Blocked tasks", blocked.length, "Waiting on client", blocked.length > 0)}
        {tile("Avg delay", `${avgDelay}d`, "Across overdue tasks", avgDelay > 0)}
      </Card>

      <SectionTitle title="Insights" subtitle="Generated from today's data by simple rules." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {insights.map((i) => (
          <Link key={i.title} href={i.href}>
            <Card className="h-full p-4 transition-colors hover:border-brand">
              <div className={clsx("flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide", i.tone)}><i.icon size={14} /> {i.title}</div>
              <p className="mt-2 text-sm">{i.text}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-brand">View detail <ArrowRight size={12} /></span>
            </Card>
          </Link>
        ))}
      </div>

      <SectionTitle title="Today's management focus" subtitle="Ranked by size × urgency: overdue work and failed payments weigh most, then reviews, blocked work and capacity, then proposals and leads." />
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="w-16 px-4 py-3 font-medium">Priority</th>
              <th className="px-3 py-3 font-medium">Focus</th>
              <th className="px-3 py-3 font-medium">Reason</th>
              <th className="px-3 py-3 font-medium">Owner</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {focus.map((f, i) => {
              const owner = f.owner ? userOf.get(f.owner) : null;
              const clear = f.count === 0;
              return (
                <tr key={f.key} className={clsx("border-b border-border last:border-0", clear && "text-muted")}>
                  <td className="px-4 py-3"><span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", clear ? "bg-background" : "bg-brand-soft text-brand")}>{i + 1}</span></td>
                  <td className="px-3 py-3"><span className="inline-flex items-center gap-2 font-medium"><f.icon size={15} className="text-muted" /> {f.title}</span></td>
                  <td className="px-3 py-3">{clear ? "All clear" : f.reason}</td>
                  <td className="px-3 py-3">{owner ? <span className="inline-flex items-center gap-1.5"><Avatar user={owner} size="xs" /> {owner.name}</span> : <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-3 text-right">{!clear && <Link href={f.href} className="inline-flex items-center gap-1 text-xs text-brand">Open <ArrowRight size={12} /></Link>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <SectionTitle title="Performance overview" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Revenue this month" value={R(revenueMtd)} hint="Excl. VAT, payments received" />
        <Kpi label="WIP value" value={R(sum(wipBuckets, (b) => b.value))} hint="Billable work on unfinished tasks" />
        <Kpi label="Utilisation this month" value={`${util}%`} hint="Billable ÷ available hours" />
        <Kpi label="Avg turnaround" value={turnaround === null ? "—" : `${turnaround}d`} hint="Created → done, last 30 days" />
        <Kpi label="Completed / opened" value={`${completed30.length} / ${opened30}`} hint={completed30.length < opened30 ? "Backlog growing: opening more than completing" : "Keeping up with new work"} alert={completed30.length < opened30} />
        <Kpi label="Avg onboarding time" value={onboardDays === null ? "—" : `${onboardDays}d`} hint="Signed-up → complete, last 90 days" />
      </div>
    </>
  );
}
