import clsx from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CheckCircle2, Circle } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge, Card } from "@/components/ui";
import { formatDate, formatDateTime, toISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { CancelEnrollment } from "../controls";

export const metadata = { title: "Onboarding progress" };

export default async function EnrollmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("resources.view");
  const { id } = await params;
  const e = await db.enrollment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      mentor: { select: { id: true, name: true } },
      programme: { select: { name: true, description: true } },
      steps: { orderBy: { position: "asc" }, include: { task: { select: { id: true, dueDate: true, status: true } } } },
    },
  });
  const allowed = e && (e.userId === user.id || e.mentorId === user.id || can(user.role, "team.manage") || can(user.role, "workload.viewAll"));
  if (!e || !allowed) notFound();
  const resources = await db.resource.findMany({ where: { id: { in: e.steps.map((s) => s.resourceId).filter((x): x is string => !!x) } }, select: { id: true, title: true } });
  const titleOf = new Map(resources.map((r) => [r.id, r.title]));
  const done = e.steps.filter((s) => s.completedAt).length;
  const today = todayISO();

  return (
    <div className="max-w-3xl">
      <Link href="/resources/staff-onboarding" className="text-xs text-muted hover:text-brand">← Staff Onboarding</Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{e.programme.name}</h1>
        {e.status === "COMPLETED" ? <Badge tone="success">Completed</Badge> : e.status === "CANCELLED" ? <Badge>Cancelled</Badge> : <Badge tone="brand">In progress</Badge>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5"><Avatar user={e.user} size="xs" /> {e.user.name}</span>
        {e.mentor && <span>Mentor: {e.mentor.name}</span>}
        <span>Started {formatDate(e.startDate, { day: "numeric", month: "long", year: "numeric" })}</span>
        {e.completedAt && <span>Finished {formatDateTime(e.completedAt)}</span>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-background"><div className="h-full bg-success" style={{ width: `${e.steps.length ? (done / e.steps.length) * 100 : 0}%` }} /></div>
        <span className="text-sm text-muted">{done}/{e.steps.length}</span>
      </div>

      <Card className="mt-4 divide-y divide-border p-0">
        {e.steps.map((s) => {
          const due = s.task?.dueDate ? toISODate(s.task.dueDate) : null;
          const late = !s.completedAt && due && due < today;
          return (
            <div key={s.id} className="flex items-start gap-3 px-5 py-3">
              {s.completedAt ? <CheckCircle2 size={18} className="mt-0.5 text-success" /> : <Circle size={18} className="mt-0.5 text-border" />}
              <div className="min-w-0 flex-1">
                {s.task ? <Link href={`/tasks?task=${s.task.id}`} className={clsx("text-sm font-medium hover:text-brand", s.completedAt && "text-muted line-through")}>{s.title}</Link> : <span className="text-sm font-medium">{s.title}</span>}
                {s.resourceId && (
                  <Link href={`/resources/${s.resourceId}`} className="mt-0.5 flex items-center gap-1 text-xs text-brand"><BookOpen size={12} /> Read: {titleOf.get(s.resourceId) ?? "SOP"}</Link>
                )}
              </div>
              <span className={clsx("text-xs", late ? "font-medium text-danger" : "text-muted")}>
                {s.completedAt ? `Done ${formatDate(s.completedAt.toISOString().slice(0, 10), { day: "numeric", month: "short" })}` : due ? `Due ${formatDate(due, { day: "numeric", month: "short" })}` : ""}
              </span>
            </div>
          );
        })}
      </Card>
      {can(user.role, "team.manage") && e.status === "ACTIVE" && <div className="mt-4"><CancelEnrollment id={e.id} /></div>}
    </div>
  );
}
