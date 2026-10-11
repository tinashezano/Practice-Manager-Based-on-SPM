"use client";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { createTask } from "@/app/(app)/tasks/actions";
import { useAction } from "./use-action";

export function QuickAdd({
  clientId,
  projectId,
  parentId,
  label = "Add task",
  indent = 0,
}: {
  clientId?: string;
  projectId?: string | null;
  parentId?: string;
  label?: string;
  indent?: number;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { run, pending, toast } = useAction();

  function submit() {
    const t = title.trim();
    if (!t) return setOpen(false);
    run(
      () => createTask({ title: t, clientId, projectId: projectId ?? null, parentId }),
      () => {
        setTitle("");
        inputRef.current?.focus();
      },
    );
  }

  return (
    <div style={{ paddingLeft: indent }} className="py-1">
      {toast}
      {open ? (
        <input
          ref={inputRef}
          autoFocus
          value={title}
          disabled={pending}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
          onBlur={() => !title.trim() && setOpen(false)}
          placeholder={`${label}… (Enter to save, Esc to cancel)`}
          className="w-full rounded-md border border-brand bg-surface px-2 py-1 text-sm outline-none ring-2 ring-brand-soft"
        />
      ) : (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-muted hover:text-brand">
          <Plus size={13} /> {label}
        </button>
      )}
    </div>
  );
}
