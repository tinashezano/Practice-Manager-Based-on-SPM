"use client";

import clsx from "clsx";
import Link from "next/link";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { OnboardingStage } from "@prisma/client";
import { Mail } from "lucide-react";
import { useOptimistic } from "react";
import { moveStage } from "@/app/(app)/clients/[id]/onboarding/actions";
import { Avatar } from "@/components/avatar";
import { useAction } from "@/components/tasks/use-action";
import { STAGES, STAGE_INFO } from "@/lib/onboarding-meta";

export type BoardItem = {
  id: string;
  clientId: string;
  clientName: string;
  stage: OnboardingStage;
  owner: { id: string; name: string } | null;
  infoReceived: number;
  infoTotal: number;
  setupDone: number;
  setupTotal: number;
  daysInStage: number;
  remindersSent: number;
};

function Card({ item }: { item: BoardItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const stuck = item.stage !== "COMPLETE" && item.daysInStage > 7;
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined} className={clsx("cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm", isDragging && "z-10 opacity-80 shadow-lg")}>
      <Link href={`/clients/${item.clientId}/onboarding`} className="block text-sm font-medium hover:text-brand">{item.clientName}</Link>
      <div className="mt-2 space-y-1.5 text-[11px] text-muted">
        <Bar label="Client info" value={item.infoReceived} total={item.infoTotal} />
        <Bar label="Setup" value={item.setupDone} total={item.setupTotal} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span className={clsx(stuck && "font-medium text-warning")}>{item.daysInStage}d in stage</span>
        <span className="flex items-center gap-2">{item.remindersSent > 0 && <span className="inline-flex items-center gap-0.5"><Mail size={11} />{item.remindersSent}</span>}<Avatar user={item.owner} size="xs" /></span>
      </div>
    </div>
  );
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div>
      <div className="flex justify-between"><span>{label}</span><span>{value}/{total}</span></div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-background"><div className="h-full bg-success" style={{ width: `${total ? (value / total) * 100 : 0}%` }} /></div>
    </div>
  );
}

function Column({ stage, items }: { stage: OnboardingStage; items: BoardItem[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div ref={setNodeRef} className={clsx("flex w-52 shrink-0 flex-col rounded-xl border border-border bg-background/70", isOver && "ring-2 ring-brand")}>
      <div className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide">
        <span className={clsx("h-2 w-2 rounded-full", STAGE_INFO[stage].dot)} /> {STAGE_INFO[stage].label}
        <span className="font-normal text-muted">{items.length}</span>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">{items.map((i) => <Card key={i.id} item={i} />)}</div>
    </div>
  );
}

export function OnboardingBoard({ items, canMove }: { items: BoardItem[]; canMove: boolean }) {
  const { run, toast } = useAction();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [optimistic, move] = useOptimistic(items, (state, { id, stage }: { id: string; stage: OnboardingStage }) => state.map((i) => (i.id === id ? { ...i, stage, daysInStage: 0 } : i)));

  function onDragEnd(e: DragEndEvent) {
    const stage = e.over?.id as OnboardingStage | undefined;
    const item = optimistic.find((i) => i.id === e.active.id);
    if (!stage || !item || item.stage === stage || !canMove) return;
    if (!confirm(`Move ${item.clientName} to "${STAGE_INFO[stage].label}"? This skips the automatic checks.`)) return;
    run(async () => {
      move({ id: item.id, stage });
      return moveStage(item.id, stage);
    });
  }

  return (
    <DndContext id="onboarding-board" sensors={sensors} onDragEnd={onDragEnd}>
      {toast}
      <div className="flex gap-3 overflow-x-auto pb-4">{STAGES.map((s) => <Column key={s} stage={s} items={optimistic.filter((i) => i.stage === s)} />)}</div>
    </DndContext>
  );
}
