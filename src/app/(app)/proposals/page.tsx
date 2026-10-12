import clsx from "clsx";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Badge, Button, Card, PageHeader, inputBase } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { proposalNumber } from "@/lib/firm";
import { formatRand } from "@/lib/money";
import { STATUS_LABELS, displayStatus, totalsOf, type DisplayStatus } from "@/lib/proposals";
import { requirePermission } from "@/lib/session";

export const metadata = { title: "Proposals" };

const TABS: { key: string; label: string; statuses: DisplayStatus[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "draft", label: "Draft", statuses: ["DRAFT"] },
  { key: "awaiting", label: "Awaiting acceptance", statuses: ["SENT"] },
  { key: "viewed", label: "Viewed", statuses: ["VIEWED"] },
  { key: "signed", label: "Awaiting payment", statuses: ["SIGNED"] },
  { key: "accepted", label: "Accepted", statuses: ["ACCEPTED"] },
  { key: "closed", label: "Declined / withdrawn", statuses: ["DECLINED", "WITHDRAWN"] },
  { key: "expired", label: "Expired", statuses: ["EXPIRED"] },
];

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  await requirePermission("proposals.manage");
  const { tab = "all", q } = await searchParams;
  const where: Prisma.ProposalWhereInput = q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { deal: { name: { contains: q, mode: "insensitive" } } }] } : {};
  const all = await db.proposal.findMany({ where, include: { deal: { select: { id: true, name: true, owner: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 500 });
  const rows = all.map((p) => ({ ...p, display: displayStatus(p) }));
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]!;
  const shown = active.statuses ? rows.filter((r) => active.statuses!.includes(r.display)) : rows;

  return (
    <>
      <PageHeader title="Proposals" subtitle="Create, send and track proposals. Start a new one from a lead's page." actions={<Link href="/deals"><Button variant="secondary">Choose a lead</Button></Link>} />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const count = t.statuses ? rows.filter((r) => t.statuses!.includes(r.display)).length : rows.length;
          return (
            <Link key={t.key} href={`/proposals?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={clsx("-mb-px border-b-2 px-3 py-2 text-sm", t.key === active.key ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-foreground")}>
              {t.label} <span className="ml-1 rounded-full bg-background px-1.5 text-xs">{count}</span>
            </Link>
          );
        })}
      </div>
      <form className="mb-4">
        <input type="hidden" name="tab" value={active.key} />
        <div className="relative w-72">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Search proposals" className={`${inputBase} w-full py-1.5 pl-8`} />
        </div>
      </form>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Client / proposal</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 text-right font-medium">Due on acceptance</th>
              <th className="px-3 py-3 text-right font-medium">Monthly</th>
              <th className="px-3 py-3 font-medium">Created</th>
              <th className="px-5 py-3 font-medium">Valid until</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const t = totalsOf(p);
              return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-5 py-3">
                    <Link href={`/proposals/${p.id}`} className="font-medium hover:text-brand">{p.deal.name}</Link>
                    <div className="text-xs text-muted">{proposalNumber(p.number)} · {p.title}</div>
                  </td>
                  <td className="px-3 py-3"><Badge tone={STATUS_LABELS[p.display].tone}>{STATUS_LABELS[p.display].label}</Badge></td>
                  <td className="px-3 py-3 text-right">{formatRand(t.dueNow)}</td>
                  <td className="px-3 py-3 text-right text-muted">{t.monthly ? formatRand(t.monthly) : "—"}</td>
                  <td className="px-3 py-3 text-muted">{formatDate(p.createdAt.toISOString().slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-5 py-3 text-muted">{formatDate(p.validUntil, { day: "numeric", month: "short", year: "numeric" })}</td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={6} className="py-12 text-center text-muted">No proposals here.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
