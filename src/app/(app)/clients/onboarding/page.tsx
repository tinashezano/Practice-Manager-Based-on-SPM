import { OnboardingBoard, type BoardItem } from "@/components/onboarding/board";
import { PageHeader, StatCard } from "@/components/ui";
import { db } from "@/lib/db";
import { progress } from "@/lib/onboarding";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

export const metadata = { title: "Onboarding" };

export default async function OnboardingBoardPage() {
  const user = await requirePermission("clients.view");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await db.onboarding.findMany({
    where: { OR: [{ stage: { not: "COMPLETE" } }, { completedAt: { gte: since } }] },
    include: { client: { select: { id: true, name: true } }, items: { select: { kind: true, required: true, status: true } } },
    orderBy: { stageChangedAt: "asc" },
  });
  const owners = await db.user.findMany({ where: { id: { in: rows.map((r) => r.ownerId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const ownerOf = new Map(owners.map((o) => [o.id, o]));

  const items: BoardItem[] = rows.map((r) => {
    const p = progress(r.items);
    return {
      id: r.id,
      clientId: r.client.id,
      clientName: r.client.name,
      stage: r.stage,
      owner: r.ownerId ? ownerOf.get(r.ownerId) ?? null : null,
      infoReceived: p.infoReceived,
      infoTotal: p.infoTotal,
      setupDone: p.setupDone,
      setupTotal: p.setupTotal,
      daysInStage: Math.floor((Date.now() - r.stageChangedAt.getTime()) / 86_400_000),
      remindersSent: r.remindersSent,
    };
  });
  const open = items.filter((i) => i.stage !== "COMPLETE");
  const waiting = open.filter((i) => i.stage === "INFO_REQUESTED" && i.daysInStage > 7);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return (
    <>
      <PageHeader title="Onboarding" subtitle="New clients from signed-up to fully set up. Stages move automatically as the client uploads and you work through the checklist." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="In progress" value={open.length} />
        <StatCard label="Waiting on client 7+ days" value={<span className={waiting.length ? "text-warning" : ""}>{waiting.length}</span>} hint="Reminders go out automatically" />
        <StatCard label="Ready for review" value={open.filter((i) => i.stage === "REVIEW").length} />
        <StatCard label="Completed this month" value={rows.filter((r) => r.completedAt && r.completedAt >= monthStart).length} />
      </div>
      <OnboardingBoard items={items} canMove={can(user.role, "clients.manage")} />
    </>
  );
}
