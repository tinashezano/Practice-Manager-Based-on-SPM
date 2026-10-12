import Link from "next/link";
import { Plus } from "lucide-react";
import { DealBoard, type BoardDeal } from "@/components/deals/deal-board";
import { Button, PageHeader, StatCard } from "@/components/ui";
import { OPEN_STAGES, STAGE_META, formatZAR, probabilityOf } from "@/lib/deal-meta";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  await requirePermission("deals.manage");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const deals = await db.deal.findMany({
    // Open deals, plus anything won or lost in the last 30 days.
    where: { OR: [{ stage: { in: OPEN_STAGES } }, { stageChangedAt: { gte: since } }] },
    include: {
      owner: { select: { id: true, name: true } },
      tasks: { where: { status: { not: "DONE" }, parentId: null }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }], take: 1, select: { title: true, dueDate: true } },
    },
    orderBy: { stageChangedAt: "asc" },
  });

  const open = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const openValue = open.reduce((n, d) => n + d.valueCents, 0);
  const weighted = open.reduce((n, d) => n + (d.valueCents * probabilityOf(d)) / 100, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const wonThisMonth = deals.filter((d) => d.stage === "WON" && d.stageChangedAt >= monthStart);
  const stalled = open.filter((d) => Date.now() - d.stageChangedAt.getTime() > 14 * 86_400_000);

  const board: BoardDeal[] = deals.map((d) => ({
    id: d.id,
    name: d.name,
    contactName: d.contactName,
    stage: d.stage,
    valueCents: d.valueCents,
    probability: probabilityOf(d),
    daysInStage: Math.floor((Date.now() - d.stageChangedAt.getTime()) / 86_400_000),
    owner: d.owner,
    nextTask: d.tasks[0] ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle="Drag a deal to change its stage. Won happens automatically when a deal converts to a client."
        actions={<Link href="/deals/new"><Button><Plus size={15} /> New lead</Button></Link>}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open pipeline" value={formatZAR(openValue)} hint={`${open.length} open deal${open.length === 1 ? "" : "s"}`} />
        <StatCard label="Weighted forecast" value={formatZAR(weighted)} hint="Value × stage probability" />
        <StatCard label="Won this month" value={formatZAR(wonThisMonth.reduce((n, d) => n + d.valueCents, 0))} hint={`${wonThisMonth.length} deal${wonThisMonth.length === 1 ? "" : "s"}`} />
        <StatCard
          label="Stalled"
          value={<span className={stalled.length ? "text-warning" : ""}>{stalled.length}</span>}
          hint={`Open deals unchanged for 14+ days${stalled.length ? ` · oldest in ${STAGE_META[stalled[0]!.stage].label}` : ""}`}
        />
      </div>
      <DealBoard deals={board} />
    </>
  );
}
