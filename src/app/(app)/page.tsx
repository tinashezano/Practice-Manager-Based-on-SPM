import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DueDate, StatusBadge } from "@/components/tasks/task-bits";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { addDays, parseISODate, startOfWeek, todayISO } from "@/lib/dates";
import { formatMinutes } from "@/lib/time-format";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { taskHome } from "@/lib/task-meta";

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-ZA", { hour: "numeric", hour12: false, timeZone: "Africa/Johannesburg" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

const taskInclude = { client: { select: { id: true, name: true } }, deal: { select: { id: true, name: true } }, project: { select: { name: true } }, assignee: { select: { id: true, name: true } } } as const;

export default async function MyDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const today = parseISODate(todayISO())!;
  const weekEnd = parseISODate(addDays(todayISO(), 7))!;
  const mine = { assigneeId: user.id, status: { not: "DONE" as const } };

  const enrollment = await db.enrollment.findFirst({ where: { userId: user.id, status: "ACTIVE" }, include: { programme: { select: { name: true } }, steps: { select: { completedAt: true } } } });
  const weekStart = parseISODate(startOfWeek(todayISO()))!;
  const [dueToday, overdueCount, reviewCount, openCount, focus, reviews, logged] = await Promise.all([
    db.task.count({ where: { ...mine, dueDate: today } }),
    db.task.count({ where: { ...mine, dueDate: { lt: today } } }),
    db.task.count({ where: { reviewerId: user.id, status: "IN_REVIEW" } }),
    db.task.count({ where: mine }),
    db.task.findMany({ where: { ...mine, dueDate: { lte: weekEnd } }, include: taskInclude, orderBy: [{ dueDate: "asc" }, { priority: "desc" }], take: 15 }),
    db.task.findMany({ where: { reviewerId: user.id, status: "IN_REVIEW" }, include: taskInclude, orderBy: { dueDate: "asc" }, take: 10 }),
    db.timeEntry.aggregate({ where: { userId: user.id, date: { gte: weekStart } }, _sum: { minutes: true } }),
  ]);

  const row = (t: (typeof focus)[number]) => (
    <Link key={t.id} href={`/tasks?task=${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-background">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{t.title}</div>
        <div className="truncate text-xs text-muted">{taskHome(t).name}{t.project && ` · ${t.project.name}`}</div>
      </div>
      <StatusBadge status={t.status} />
      <span className="w-20 text-right"><DueDate date={t.dueDate} /></span>
      <Avatar user={t.assignee} size="xs" />
    </Link>
  );

  return (
    <>
      <PageHeader title={`${greeting()}, ${user.name.split(" ")[0]}`} subtitle="Your day at a glance." />
      {denied && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-warning">You don&apos;t have access to that page. Ask a Director if you need it.</p>}

      {enrollment && (
        <Link href={`/resources/staff-onboarding/${enrollment.id}`} className="mb-6 flex items-center gap-4 rounded-xl border border-brand/30 bg-brand-soft/60 px-5 py-4 hover:border-brand">
          <GraduationCap size={22} className="text-brand" />
          <div className="flex-1">
            <div className="text-sm font-semibold">Your onboarding: {enrollment.programme.name}</div>
            <div className="mt-1.5 h-1.5 max-w-md overflow-hidden rounded-full bg-surface"><div className="h-full bg-success" style={{ width: `${(enrollment.steps.filter((s) => s.completedAt).length / Math.max(1, enrollment.steps.length)) * 100}%` }} /></div>
          </div>
          <span className="text-sm text-muted">{enrollment.steps.filter((s) => s.completedAt).length}/{enrollment.steps.length} steps</span>
        </Link>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Due today" value={dueToday} hint="Assigned to you" />
        <StatCard label="Overdue" value={<span className={overdueCount ? "text-danger" : ""}>{overdueCount}</span>} hint="Past due, not done" />
        <StatCard label="Awaiting my review" value={reviewCount} hint="Tasks in review where you're reviewer" />
        <StatCard label="My open tasks" value={openCount} hint="All open tasks assigned to you" />
        <StatCard label="Logged this week" value={formatMinutes(logged._sum.minutes ?? 0)} hint="From your timesheet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">My focus: overdue and due this week</h2>
            <Link href="/tasks?assignee=me" className="inline-flex items-center gap-1 text-xs text-brand">All my tasks <ArrowRight size={12} /></Link>
          </div>
          <div className="divide-y divide-border">
            {focus.map(row)}
            {focus.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">Nothing due this week. 🎉</p>}
          </div>
        </Card>
        <Card className="p-0">
          <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Waiting for my review</h2></div>
          <div className="divide-y divide-border">
            {reviews.map(row)}
            {reviews.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No reviews waiting.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
