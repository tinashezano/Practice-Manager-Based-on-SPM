import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { ClientStatus, Prisma } from "@prisma/client";
import { Avatar } from "@/components/avatar";
import { Badge, Button, Card, PageHeader, inputBase } from "@/components/ui";
import { parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { CLIENT_STATUS_META, ENTITY_LABELS } from "@/lib/task-meta";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await requirePermission("clients.view");
  const { q, status } = await searchParams;
  const where: Prisma.ClientWhereInput = {};
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (status && status in CLIENT_STATUS_META) where.status = status as ClientStatus;
  else if (!status) where.status = { not: "INACTIVE" };

  const today = parseISODate(todayISO())!;
  const clients = await db.client.findMany({
    where,
    orderBy: [{ isInternal: "desc" }, { name: "asc" }],
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { projects: { where: { status: "ACTIVE" } } } },
    },
  });
  const [open, overdue] = await Promise.all([
    db.task.groupBy({ by: ["clientId"], where: { parentId: null, status: { not: "DONE" } }, _count: true }),
    db.task.groupBy({ by: ["clientId"], where: { parentId: null, status: { not: "DONE" }, dueDate: { lt: today } }, _count: true }),
  ]);
  const openBy = new Map(open.map((r) => [r.clientId, r._count]));
  const overdueBy = new Map(overdue.map((r) => [r.clientId, r._count]));

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Every client, their engagements and open work."
        actions={can(user.role, "clients.manage") && <Link href="/clients/new"><Button><Plus size={15} /> New client</Button></Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Search clients" className={`${inputBase} w-64 py-1.5 pl-8`} />
        </div>
        <select name="status" defaultValue={status ?? ""} className={`${inputBase} py-1.5`}>
          <option value="">Active & onboarding</option>
          {Object.entries(CLIENT_STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <Button variant="secondary">Filter</Button>
      </form>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Owner</th>
              <th className="px-3 py-3 text-right font-medium">Projects</th>
              <th className="px-3 py-3 text-right font-medium">Open tasks</th>
              <th className="px-5 py-3 text-right font-medium">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-background">
                <td className="px-5 py-3">
                  <Link href={`/clients/${c.id}`} className="font-medium hover:text-brand">{c.name}</Link>
                  {c.isInternal && <span className="ml-2"><Badge>Internal</Badge></span>}
                </td>
                <td className="px-3 py-3 text-muted">{c.isInternal ? "—" : ENTITY_LABELS[c.entityType]}</td>
                <td className="px-3 py-3"><Badge tone={CLIENT_STATUS_META[c.status].tone}>{CLIENT_STATUS_META[c.status].label}</Badge></td>
                <td className="px-3 py-3">{c.owner ? <span className="inline-flex items-center gap-2"><Avatar user={c.owner} size="xs" /> {c.owner.name}</span> : <span className="text-muted">—</span>}</td>
                <td className="px-3 py-3 text-right">{c._count.projects}</td>
                <td className="px-3 py-3 text-right">{openBy.get(c.id) ?? 0}</td>
                <td className="px-5 py-3 text-right">{overdueBy.get(c.id) ? <span className="font-medium text-danger">{overdueBy.get(c.id)}</span> : <span className="text-muted">0</span>}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-muted">No clients found.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
