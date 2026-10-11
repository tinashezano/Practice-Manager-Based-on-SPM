"use client";

import clsx from "clsx";
import Link from "next/link";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { TaskStatus } from "@prisma/client";
import { useOptimistic } from "react";
import { updateTask } from "@/app/(app)/tasks/actions";
import { Avatar } from "@/components/avatar";
import type { TaskRow } from "@/lib/task-queries";
import { STATUS_META, TASK_STATUSES } from "@/lib/task-meta";
import { CommentCount, DueDate, PriorityBadge, StatusDot, SubtaskProgress } from "./task-bits";
import { useAction } from "./use-action";
import { useParamLink } from "./use-task-link";

function Card({ task }: { task: TaskRow }) {
  const { hrefWith } = useParamLink();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={clsx("cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm", isDragging && "z-10 opacity-80 shadow-lg")}
    >
      <div className="mb-1 truncate text-[11px] font-medium text-muted">
        {task.client.name}{task.project && ` · ${task.project.name}`}
      </div>
      <Link href={hrefWith({ task: task.id })} scroll={false} className="block text-sm font-medium hover:text-brand">
        {task.title}
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <DueDate date={task.dueDate} done={task.status === "DONE"} />
        <SubtaskProgress subtasks={task.subtasks} />
        <CommentCount count={task._count.comments} />
        <PriorityBadge priority={task.priority} />
        <span className="ml-auto"><Avatar user={task.assignee} size="xs" /></span>
      </div>
    </div>
  );
}

function Column({ status, tasks }: { status: TaskStatus; tasks: TaskRow[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={clsx("flex w-72 shrink-0 flex-col rounded-xl border border-border bg-background/70", isOver && "ring-2 ring-brand")}>
      <div className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide">
        <StatusDot status={status} /> {STATUS_META[status].label}
        <span className="font-normal text-muted">{tasks.length}</span>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {tasks.map((t) => <Card key={t.id} task={t} />)}
      </div>
    </div>
  );
}

export function TaskBoard({ tasks, showDone }: { tasks: TaskRow[]; showDone: boolean }) {
  const { run, toast } = useAction();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [optimistic, move] = useOptimistic(tasks, (state, { id, status }: { id: string; status: TaskStatus }) =>
    state.map((t) => (t.id === id ? { ...t, status } : t)),
  );

  function onDragEnd(e: DragEndEvent) {
    const status = e.over?.id as TaskStatus | undefined;
    const task = optimistic.find((t) => t.id === e.active.id);
    if (!status || !task || task.status === status) return;
    run(async () => {
      move({ id: task.id, status });
      return updateTask(task.id, { status });
    });
  }

  const columns = showDone ? TASK_STATUSES : TASK_STATUSES.filter((s) => s !== "DONE");
  return (
    <DndContext id="task-board" sensors={sensors} onDragEnd={onDragEnd}>
      {toast}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((s) => <Column key={s} status={s} tasks={optimistic.filter((t) => t.status === s)} />)}
        {!showDone && (
          <div className="w-52 shrink-0 self-start rounded-xl border border-dashed border-border p-3 text-xs text-muted">
            Drag cards between columns to change their status. Set Status to “All” to show the Done column.
          </div>
        )}
      </div>
    </DndContext>
  );
}
