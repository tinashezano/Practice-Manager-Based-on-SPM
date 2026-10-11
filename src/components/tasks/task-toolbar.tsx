"use client";

import clsx from "clsx";
import { CalendarDays, GanttChart, KanbanSquare, List, Search } from "lucide-react";
import { useState } from "react";
import { inputBase } from "@/components/ui";
import { useParamLink } from "./use-task-link";

const VIEWS = [
  { id: "list", label: "List", icon: List },
  { id: "board", label: "Board", icon: KanbanSquare },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "timeline", label: "Timeline", icon: GanttChart },
] as const;

type Option = { id: string; name: string };

export function TaskToolbar({ clients, staff, showClientFilter = true }: { clients: Option[]; staff: Option[]; showClientFilter?: boolean }) {
  const { go, params } = useParamLink();
  const view = params.get("view") ?? "list";
  const [q, setQ] = useState(params.get("q") ?? "");
  const select = `${inputBase} py-1.5`;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-border bg-surface p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => go({ view: v.id === "list" ? null : v.id })}
            className={clsx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", view === v.id ? "bg-brand-soft font-medium text-brand" : "text-muted hover:text-foreground")}
          >
            <v.icon size={15} /> {v.label}
          </button>
        ))}
      </div>

      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: q.trim() || null });
        }}
      >
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q !== (params.get("q") ?? "") && go({ q: q.trim() || null })} placeholder="Search tasks" className={`${inputBase} w-48 py-1.5 pl-8`} />
      </form>

      {showClientFilter && (
        <select aria-label="Client" value={params.get("client") ?? ""} onChange={(e) => go({ client: e.target.value || null, project: null })} className={select}>
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      <select aria-label="Assignee" value={params.get("assignee") ?? ""} onChange={(e) => go({ assignee: e.target.value || null })} className={select}>
        <option value="">Everyone</option>
        <option value="me">My tasks</option>
        {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>

      <select aria-label="Status" value={params.get("status") ?? "open"} onChange={(e) => go({ status: e.target.value === "open" ? null : e.target.value })} className={select}>
        <option value="open">Open</option>
        <option value="done">Done</option>
        <option value="all">All</option>
      </select>
    </div>
  );
}
