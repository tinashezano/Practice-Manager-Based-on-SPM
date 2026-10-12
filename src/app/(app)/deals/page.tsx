import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { DealStage, Prisma } from "@prisma/client";
import { Avatar } from "@/components/avatar";
import { Badge, Button, Card, PageHeader, inputBase } from "@/components/ui";
import { DEAL_STAGES, OPEN_STAGES, SOURCE_LABELS, STAGE_META, formatZAR, probabilityOf } from "@/lib/deal-meta";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const metadata = { title: "Deals" };

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ q?: string; stage?: string; owner?: string }> }) {
  await requirePermission("deals.manage");
  const { q, stage, owner } = await searchParams;
  const where: Prisma.DealWhereInput = {};
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }];
  if (stage === "open" || !stage) where.stage = { in: OPEN_STAGES };
  else if (stage !== "all" && DEAL_STAGES.includes(stage as DealStage)) where.stage = stage as DealStage;
  if (owner) where.ownerId = owner;

  const [deals, staff] = await Promise.all([
    db.deal.findMany({ where, include: { owner: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Deals" subtitle="Every lead and deal. Use the Pipeline for the board view." actions={<Link href="/deals/new"><Button><Plus size={15} /> New lead</Button></Link>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Search name, contact or email" className={`${inputBase} w-64 py-1.5 pl-8`} />
        </div>
        <select name="stage" defaultValue={stage ?? "open"} className={`${inputBase} py-1.5`}>
          <option value="open">All open</option>
          {DEAL_STAGES.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
          <option value="all">Everything</option>
        </select>
        <select name="owner" defaultValue={owner ?? ""} className={`${inputBase} py-1.5`}>
          <option value="">Any owner</option>
          {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <Button variant="secondary">Filter</Button>
      </form>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Lead</th>
              <th className="px-3 py-3 font-medium">Stage</th>
              <th className="px-3 py-3 text-right font-medium">Value</th>
              <th className="px-3 py-3 text-right font-medium">Prob.</th>
              <th className="px-3 py-3 font-medium">Source</th>
              <th className="px-3 py-3 font-medium">Created</th>
              <th className="px-5 py-3 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0 hover:bg-background">
                <td className="px-5 py-3">
                  <Link href={`/deals/${d.id}`} className="font-medium hover:text-brand">{d.name}</Link>
                  <div className="text-xs text-muted">{d.contactName}{d.email && ` · ${d.email}`}</div>
                </td>
                <td className="px-3 py-3"><Badge tone={STAGE_META[d.stage].tone}>{STAGE_META[d.stage].label}</Badge></td>
                <td className="px-3 py-3 text-right">{d.valueCents ? formatZAR(d.valueCents) : "—"}</td>
                <td className="px-3 py-3 text-right text-muted">{probabilityOf(d)}%</td>
                <td className="px-3 py-3 text-muted">{SOURCE_LABELS[d.source]}</td>
                <td className="px-3 py-3 text-muted">{formatDate(d.createdAt.toISOString().slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="px-5 py-3"><Avatar user={d.owner} /></td>
              </tr>
            ))}
            {deals.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted">No deals found.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
