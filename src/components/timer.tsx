"use client";

import clsx from "clsx";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { startTimerAction, stopTimerAction } from "@/app/(app)/time/actions";
import { useAction } from "@/components/tasks/use-action";
import { formatClock } from "@/lib/time-format";

export type RunningTimer = { startedAt: string; label: string; taskId: string | null } | null;

function useElapsed(startedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000)) : 0;
}

/** Sidebar timer: shows the running timer, or starts a general one. */
export function SidebarTimer({ timer, collapsed }: { timer: RunningTimer; collapsed: boolean }) {
  const { run, pending, toast } = useAction();
  const elapsed = useElapsed(timer?.startedAt ?? null);
  return (
    <div className={clsx("border-t border-border px-4 py-3", collapsed && "px-2")}>
      {toast}
      <div className="flex items-center justify-center gap-2">
        {!collapsed && <span className={clsx("font-mono text-base tabular-nums", timer ? "text-foreground" : "text-muted")} suppressHydrationWarning>{formatClock(elapsed)}</span>}
        <button
          disabled={pending}
          onClick={() => run(() => (timer ? stopTimerAction() : startTimerAction(null)))}
          className={clsx("flex h-7 w-7 items-center justify-center rounded-full text-white", timer ? "bg-danger" : "bg-brand")}
          aria-label={timer ? "Stop timer" : "Start timer"}
          title={timer ? "Stop timer" : "Start a general timer (or start one from a task)"}
        >
          {timer ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
        </button>
      </div>
      {!collapsed && timer && (
        <Link href={timer.taskId ? `/tasks?task=${timer.taskId}` : "/time"} className="mt-1 block truncate text-center text-[11px] text-muted hover:text-brand">{timer.label}</Link>
      )}
    </div>
  );
}

/** Timer controls inside the task panel. */
export function TaskTimer({ taskId, running }: { taskId: string; running: RunningTimer }) {
  const { run, pending, toast } = useAction();
  const mine = running?.taskId === taskId;
  const elapsed = useElapsed(mine ? running!.startedAt : null);
  return (
    <>
      {toast}
      <button
        disabled={pending}
        onClick={() => run(() => (mine ? stopTimerAction() : startTimerAction(taskId)))}
        className={clsx("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white", mine ? "bg-danger" : "bg-brand")}
      >
        {mine ? <Pause size={13} /> : <Play size={13} />}
        {mine ? <span className="font-mono tabular-nums" suppressHydrationWarning>{formatClock(elapsed)}</span> : running ? "Switch timer here" : "Start timer"}
      </button>
    </>
  );
}
