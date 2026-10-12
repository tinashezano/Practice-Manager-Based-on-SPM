"use client";

import clsx from "clsx";
import { Check, Copy, Mail, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useOptimistic, useState } from "react";
import type { OnboardingStage } from "@prisma/client";
import { useAction } from "@/components/tasks/use-action";
import { Button, inputBase, inputClass } from "@/components/ui";
import { STAGES, STAGE_INFO } from "@/lib/onboarding-meta";
import { addItem, approve, decideItem, moveStage, remindNow, removeItem, setPeople, setSetupItem, startManualOnboarding } from "./actions";

export function InfoItemControls({ itemId, status, canRemove }: { itemId: string; status: string; canRemove: boolean }) {
  const { run, pending, toast } = useAction();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  if (rejecting) {
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {toast}
        <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's wrong? The client sees this." className={`${inputBase} w-72 py-1.5`} />
        <Button variant="secondary" disabled={pending || !note.trim()} onClick={() => run(() => decideItem(itemId, "REJECTED", note), () => setRejecting(false))}>Send back</Button>
        <Button variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-1">
      {toast}
      {status !== "ACCEPTED" && <button disabled={pending} onClick={() => run(() => decideItem(itemId, "ACCEPTED"))} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-success hover:text-success"><Check size={12} /> Accept</button>}
      {status === "RECEIVED" && <button disabled={pending} onClick={() => setRejecting(true)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-warning hover:text-warning"><RotateCcw size={12} /> Send back</button>}
      {status !== "NOT_APPLICABLE" && status !== "ACCEPTED" && <button disabled={pending} onClick={() => run(() => decideItem(itemId, "NOT_APPLICABLE"))} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-background">N/A</button>}
      {(status === "ACCEPTED" || status === "NOT_APPLICABLE") && <button disabled={pending} onClick={() => run(() => decideItem(itemId, "PENDING"))} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-background">Undo</button>}
      {canRemove && <button disabled={pending} onClick={() => confirm("Remove this item?") && run(() => removeItem(itemId))} className="rounded-md p-1 text-muted hover:text-danger" aria-label="Remove item"><Trash2 size={13} /></button>}
    </div>
  );
}

export function SetupCheck({ itemId, done, label, by }: { itemId: string; done: boolean; label: string; by?: string }) {
  const { run, pending, toast } = useAction();
  const [checked, setChecked] = useOptimistic(done);
  return (
    <label className="flex items-center gap-2.5 py-1.5 text-sm">
      {toast}
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          run(async () => {
            setChecked(next);
            return setSetupItem(itemId, next);
          });
        }}
        className="h-4 w-4 accent-[var(--success)]"
      />
      <span className={clsx(checked && "text-muted line-through")}>{label}</span>
      {by && <span className="text-xs text-muted">· {by}</span>}
    </label>
  );
}

export function AddItem({ onboardingId, kind }: { onboardingId: string; kind: "INFO" | "SETUP" }) {
  const { run, pending, toast } = useAction();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState(true);
  const [allowsText, setAllowsText] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand"><Plus size={13} /> {kind === "INFO" ? "Request another item" : "Add setup step"}</button>;
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      {toast}
      <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === "INFO" ? "e.g. Lease agreement for business premises" : "e.g. Set up debit order"} className={inputClass} />
      {kind === "INFO" && <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short explanation for the client (optional)" className={inputClass} />}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required</label>
        {kind === "INFO" && <label className="flex items-center gap-1.5"><input type="checkbox" checked={allowsText} onChange={(e) => setAllowsText(e.target.checked)} /> Client can type an answer</label>}
      </div>
      <div className="flex gap-2">
        <Button disabled={pending || label.trim().length < 2} onClick={() => run(() => addItem({ onboardingId, kind, label, description, required, allowsText }), () => { setOpen(false); setLabel(""); setDescription(""); })}>Add</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export function LinkTools({ onboardingId, url, canRemind }: { onboardingId: string; url: string; canRemind: boolean }) {
  const { run, pending, toast } = useAction();
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      {toast}
      <button onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background">
        <Copy size={13} /> {copied ? "Copied" : "Copy upload link"}
      </button>
      {canRemind && (
        <button disabled={pending} onClick={() => run(() => remindNow(onboardingId), () => setSent(true))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background">
          <Mail size={13} /> {pending ? "Sending…" : sent ? "Reminder queued" : "Send reminder now"}
        </button>
      )}
    </div>
  );
}

export function StageBar({ onboardingId, stage, canMove }: { onboardingId: string; stage: OnboardingStage; canMove: boolean }) {
  const { run, pending, toast } = useAction();
  const idx = STAGES.indexOf(stage);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {toast}
      <ol className="flex flex-1 flex-wrap items-center gap-1">
        {STAGES.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <span className={clsx("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", i < idx ? "bg-green-50 text-success" : i === idx ? "bg-brand text-white" : "bg-background text-muted")}>
              {i < idx ? <Check size={12} /> : <span>{i + 1}</span>} {STAGE_INFO[s].label}
            </span>
            {i < STAGES.length - 1 && <span className="h-px w-3 bg-border" />}
          </li>
        ))}
      </ol>
      {canMove && (
        <select value="" disabled={pending} onChange={(e) => e.target.value && confirm(`Move to "${STAGE_INFO[e.target.value as OnboardingStage].label}"? This skips the automatic checks.`) && run(() => moveStage(onboardingId, e.target.value as OnboardingStage))} className={`${inputBase} py-1.5 text-xs`} aria-label="Move to stage">
          <option value="">Move manually…</option>
          {STAGES.filter((s) => s !== stage).map((s) => <option key={s} value={s}>{STAGE_INFO[s].label}</option>)}
        </select>
      )}
    </div>
  );
}

export function ReviewPanel({ onboardingId }: { onboardingId: string }) {
  const { run, pending, toast } = useAction();
  return (
    <div className="flex flex-wrap gap-2">
      {toast}
      <Button disabled={pending} onClick={() => confirm("Approve and complete onboarding? The client becomes Active and gets a 'you're all set' email.") && run(() => approve(onboardingId))}>
        <Check size={14} /> Approve and complete
      </Button>
      <Button variant="secondary" disabled={pending} onClick={() => run(() => moveStage(onboardingId, "SETUP"))}><X size={14} /> Send back to setup</Button>
    </div>
  );
}

export function PersonSelect({ onboardingId, field, value, staff, disabled }: { onboardingId: string; field: "ownerId" | "reviewerId"; value: string | null; staff: { id: string; name: string }[]; disabled: boolean }) {
  const { run, toast } = useAction();
  return (
    <>
      {toast}
      <select value={value ?? ""} disabled={disabled} onChange={(e) => run(() => setPeople(onboardingId, field, e.target.value))} className={`${inputBase} py-1 text-sm`}>
        <option value="">Nobody</option>
        {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </>
  );
}

export function StartOnboardingButton({ clientId }: { clientId: string }) {
  const { run, pending, toast } = useAction();
  return (
    <>
      {toast}
      <Button disabled={pending} onClick={() => run(() => startManualOnboarding(clientId))}>{pending ? "Starting…" : "Start onboarding & email welcome pack"}</Button>
    </>
  );
}
