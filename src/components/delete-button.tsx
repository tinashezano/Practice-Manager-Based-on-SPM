"use client";

import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/tasks/use-action";
import { inputClass } from "@/components/ui";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Delete with a confirmation. `typeToConfirm` asks the person to type a name
 * for the most destructive deletes. Errors from the server (e.g. "this deal
 * has a paid proposal") show as a toast.
 */
export function DeleteButton({ action, confirm: message, typeToConfirm, redirectTo, variant = "button", label = "Delete" }: {
  action: () => Promise<Result>;
  confirm: string;
  typeToConfirm?: string;
  redirectTo?: string;
  variant?: "button" | "icon" | "menu";
  label?: string;
}) {
  const router = useRouter();
  const { run, pending, toast } = useAction();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const go = () =>
    run(action, () => {
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  const start = (e: React.MouseEvent) => {
    // Rows are often links; don't follow them.
    e.preventDefault();
    e.stopPropagation();
    if (typeToConfirm) setOpen(true);
    else if (window.confirm(message)) go();
  };

  const trigger =
    variant === "icon" ? (
      <button type="button" onClick={start} disabled={pending} title={label} aria-label={label} className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-danger disabled:opacity-40">
        <Trash2 size={15} />
      </button>
    ) : variant === "menu" ? (
      <button type="button" onClick={start} disabled={pending} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-red-50 disabled:opacity-40">
        <Trash2 size={14} /> {pending ? "Deleting…" : label}
      </button>
    ) : (
      <button type="button" onClick={start} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-danger hover:bg-red-50 disabled:opacity-40">
        <Trash2 size={14} /> {pending ? "Deleting…" : label}
      </button>
    );

  return (
    <>
      {toast}
      {trigger}
      {open && typeToConfirm && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 p-4 pt-24" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-label={label} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-danger">{label}</h2>
              <button onClick={() => setOpen(false)} className="text-muted" aria-label="Close"><X size={18} /></button>
            </div>
            <p className="mt-2 text-sm text-muted">{message}</p>
            <label className="mt-4 block text-xs font-medium text-muted">
              Type <strong className="text-foreground">{typeToConfirm}</strong> to confirm
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className={`${inputClass} mt-1`} autoFocus aria-label="Type the name to confirm" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
              <button
                onClick={go}
                disabled={pending || typed.trim().toLowerCase() !== typeToConfirm.trim().toLowerCase()}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
