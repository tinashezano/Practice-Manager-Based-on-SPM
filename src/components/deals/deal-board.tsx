"use client";

import clsx from "clsx";
import Link from "next/link";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { DealStage } from "@prisma/client";
import { CalendarDays, Plus } from "lucide-react";
import { useOptimistic } from "react";
import { moveDeal } from "@/app/(app)/deals/actions";
import { Avatar } from "@/components/avatar";
import { useAction } from "@/components/tasks/use-action";
import { DEAL_STAGES, STAGE_META, formatZAR } from "@/lib/deal-meta";
import { formatDate, toISODate, todayISO } from "@/lib/dates";

export type BoardDeal = {
  id: string;
  name: string;
  contactName: string;
  stage: DealStage;
  valueCents: number;
  probability: number;
  daysInStage: number;
  owner: { id: string; name: string } | null;
  nextTask: { title: string; dueDate: Date | null } | null;
};

function Card({ deal }: { deal: BoardDeal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const due = deal.nextTask?.dueDate ? toISODate(deal.nextTask.dueDate) : null;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={clsx("cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm", isDragging && "z-10 opacity-80 shadow-lg")}
    >
      <Link href={`/deals/${deal.id}`} className="block text-sm font-medium hover:text-brand">{deal.name}</Link>
      <div className="truncate text-xs text-muted">{deal.contactName}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{deal.valueCents ? formatZAR(deal.valueCents) : <span className="text-xs font-normal text-muted">No value yet</span>}</span>
        <span className="text-[11px] text-muted">{deal.probability}%</span>
      </div>
      {deal.nextTask && (
        <div className={clsx("mt-2 flex items-center gap-1 truncate text-[11px]", due && due < todayISO() ? "text-danger" : "text-muted")}>
          <CalendarDays size={11} className="shrink-0" />
          <span className="truncate">{deal.nextTask.title}{due && ` · ${formatDate(deal.nextTask.dueDate)}`}</span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span className={clsx(deal.daysInStage > 14 && deal.stage !== "WON" && deal.stage !== "LOST" && "font-medium text-warning")}>{deal.daysInStage}d in stage</span>
        <Avatar user={deal.owner} size="xs" />
      </div>
    </div>
  );
}

function Column({ stage, deals }: { stage: DealStage; deals: BoardDeal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = deals.reduce((n, d) => n + d.valueCents, 0);
  const narrow = stage === "WON" || stage === "LOST";
  return (
    <div ref={setNodeRef} className={clsx("flex shrink-0 flex-col rounded-xl border border-border bg-background/70", narrow ? "w-52" : "w-60", isOver && "ring-2 ring-brand")}>
      <div className="px-3 pt-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <span className={clsx("h-2 w-2 rounded-full", STAGE_META[stage].dot)} /> {STAGE_META[stage].label}
          <span className="font-normal text-muted">{deals.length}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted">{formatZAR(total)}</div>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
        {deals.map((d) => <Card key={d.id} deal={d} />)}
        {stage === "NEW_LEAD" && (
          <Link href="/deals/new" className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs text-muted hover:border-brand hover:text-brand">
            <Plus size={13} /> Add lead
          </Link>
        )}
      </div>
    </div>
  );
}

export function DealBoard({ deals }: { deals: BoardDeal[] }) {
  const { run, toast } = useAction();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [optimistic, move] = useOptimistic(deals, (state, { id, stage }: { id: string; stage: DealStage }) =>
    state.map((d) => (d.id === id ? { ...d, stage, daysInStage: 0 } : d)),
  );

  function onDragEnd(e: DragEndEvent) {
    const stage = e.over?.id as DealStage | undefined;
    const deal = optimistic.find((d) => d.id === e.active.id);
    if (!stage || !deal || deal.stage === stage) return;
    let reason: string | undefined;
    if (stage === "LOST") {
      reason = window.prompt(`Why was ${deal.name} lost?`) ?? undefined;
      if (!reason?.trim()) return;
    }
    run(async () => {
      if (stage !== "WON") move({ id: deal.id, stage });
      return moveDeal(deal.id, stage, reason);
    });
  }

  return (
    <DndContext id="deal-board" sensors={sensors} onDragEnd={onDragEnd}>
      {toast}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {DEAL_STAGES.map((s) => <Column key={s} stage={s} deals={optimistic.filter((d) => d.stage === s)} />)}
      </div>
    </DndContext>
  );
}
