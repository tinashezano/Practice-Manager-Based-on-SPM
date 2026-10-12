import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge, Button, Card, PageHeader, inputBase } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { createProgramme } from "./actions";
import { EnrollForm } from "./controls";

export const metadata = { title: "Staff Onboarding" };

export default async function StaffOnboardingPage() {
  const user = await requirePermission("resources.view");
  const manage = can(user.role, "team.manage");
  const seeAll = manage || can(user.role, "workload.viewAll");
  const [programmes, enrollments, staff] = await Promise.all([
    db.programme.findMany({ include: { steps: { select: { dueOffsetDays: true, resourceId: true } }, _count: { select: { enrollments: true } } }, orderBy: { name: "asc" } }),
    db.enrollment.findMany({
      where: { ...(seeAll ? {} : { userId: user.id }), status: { not: "CANCELLED" } },
      include: { user: { select: { id: true, name: true } }, mentor: { select: { id: true, name: true } }, programme: { select: { name: true } }, steps: { select: { completedAt: true } } },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    manage ? db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);

  return (
    <>
      <PageHeader title="Staff Onboarding" subtitle="Programmes that bring new team members up to speed. Each step becomes a task, and reading an SOP ticks it off." />

      {manage && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold">Enrol a team member</h2>
          <EnrollForm programmes={programmes.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }))} staff={staff} />
          <p className="mt-2 text-xs text-muted">New staff member? Add them under Settings → Team & Roles first.</p>
        </Card>
      )}

      <Card className="mb-6 p-0">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold">{seeAll ? "Enrolments" : "My programmes"}</div>
        <div className="divide-y divide-border">
          {enrollments.map((e) => {
            const done = e.steps.filter((s) => s.completedAt).length;
            const pct = e.steps.length ? Math.round((done / e.steps.length) * 100) : 0;
            return (
              <Link key={e.id} href={`/resources/staff-onboarding/${e.id}`} className="flex flex-wrap items-center gap-4 px-5 py-3 text-sm hover:bg-background">
                <span className="flex w-48 items-center gap-2"><Avatar user={e.user} /> {e.user.name}</span>
                <span className="w-56 text-muted">{e.programme.name}</span>
                <span className="flex min-w-40 flex-1 items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-background"><span className="block h-full bg-success" style={{ width: `${pct}%` }} /></span>
                  <span className="text-xs text-muted">{done}/{e.steps.length}</span>
                </span>
                <span className="w-32 text-xs text-muted">from {formatDate(e.startDate, { day: "numeric", month: "short" })}{e.mentor && ` · ${e.mentor.name.split(" ")[0]}`}</span>
                {e.status === "COMPLETED" ? <Badge tone="success">Completed</Badge> : <Badge tone="brand">In progress</Badge>}
              </Link>
            );
          })}
          {!enrollments.length && <p className="px-5 py-8 text-center text-sm text-muted">{seeAll ? "Nobody is enrolled yet." : "You're not enrolled in a programme."}</p>}
        </div>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Programmes</h2>
        {manage && (
          <form action={createProgramme} className="flex gap-2">
            <input name="name" required minLength={3} placeholder="New programme name" className={`${inputBase} py-1.5`} />
            <Button variant="secondary">Create</Button>
          </form>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {programmes.map((p) => {
          const days = Math.max(0, ...p.steps.map((s) => s.dueOffsetDays));
          const card = (
            <Card className="h-full p-4 hover:border-brand">
              <div className="flex items-center gap-2 font-semibold"><GraduationCap size={16} className="text-brand" /> {p.name} {!p.active && <Badge>Inactive</Badge>}</div>
              {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
              <div className="mt-2 text-xs text-muted">{p.steps.length} steps · {days} days · {p.steps.filter((s) => s.resourceId).length} SOPs to read · {p._count.enrollments} enrolled</div>
            </Card>
          );
          return manage ? <Link key={p.id} href={`/resources/staff-onboarding/programmes/${p.id}`}>{card}</Link> : <div key={p.id}>{card}</div>;
        })}
      </div>
    </>
  );
}
