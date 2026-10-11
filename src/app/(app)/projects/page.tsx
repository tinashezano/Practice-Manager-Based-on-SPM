import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { Avatar } from "@/components/avatar";
import { Badge, Button, Card, PageHeader, inputBase } from "@/components/ui";
import { formatDate, parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { PROJECT_STATUS_META } from "@/lib/task-meta";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermission("tasks.work");
  const { status } = await searchParams;
  const statusFilter = status && status in PROJECT_STATUS_META ? (status as ProjectStatus) : status === "all" ? undefined : "ACTIVE";
  const today = parseISODate(todayISO())!;

  const projects = await db.project.findMany({
    where: statusFilter ? { status: statusFilter } : {},
    include: { client: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } } },
    orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
  });
  const ids = projects.map((p) => p.id);
  const [byStatus, overdue] = await Promise.all([
    db.task.groupBy({ by: ["projectId", "status"], where: { projectId: { in: ids }, parentId: null }, _count: true }),
    db.task.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, parentId: null, status: { not: "DONE" }, dueDate: { lt: today } }, _count: true }),
  ]);
  const overdueBy = new Map(overdue.map((r) => [r.projectId, r._count]));

  return (
    <>
      <PageHeader title="Projects" subtitle="Engagements across all clients. Create projects from a client's page." />
      <form className="mb-4 flex gap-2">
        <select name="status" defaultValue={status ?? "ACTIVE"} className={`${inputBase} py-1.5`}>
          {Object.entries(PROJECT_STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          <option value="all">All</option>
        </select>
        <Button variant="secondary">Filter</Button>
      </form>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Project</th>
              <th className="px-3 py-3 font-medium">Client</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="w-48 px-3 py-3 font-medium">Progress</th>
              <th className="px-3 py-3 font-medium">Overdue</th>
              <th className="px-3 py-3 font-medium">Due</th>
              <th className="px-5 py-3 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const rows = byStatus.filter((r) => r.projectId === p.id);
              const total = rows.reduce((n, r) => n + r._count, 0);
              const done = rows.filter((r) => r.status === "DONE").reduce((n, r) => n + r._count, 0);
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-5 py-3"><Link href={`/clients/${p.client.id}?project=${p.id}`} className="font-medium hover:text-brand">{p.name}</Link></td>
                  <td className="px-3 py-3"><Link href={`/clients/${p.client.id}`} className="text-muted hover:text-brand">{p.client.name}</Link></td>
                  <td className="px-3 py-3"><Badge tone={PROJECT_STATUS_META[p.status].tone}>{PROJECT_STATUS_META[p.status].label}</Badge></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background"><div className="h-full bg-success" style={{ width: `${pct}%` }} /></div>
                      <span className="text-xs text-muted">{done}/{total}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">{overdueBy.get(p.id) ? <span className="font-medium text-danger">{overdueBy.get(p.id)}</span> : <span className="text-muted">0</span>}</td>
                  <td className="px-3 py-3 text-muted">{p.dueDate ? formatDate(p.dueDate) : "—"}</td>
                  <td className="px-5 py-3"><Avatar user={p.owner} /></td>
                </tr>
              );
            })}
            {projects.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted">No projects.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
