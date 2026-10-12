"use client";

import { useState } from "react";
import type { DealStage } from "@prisma/client";
import { useAction } from "@/components/tasks/use-action";
import { Button, inputBase, inputClass } from "@/components/ui";
import { OPEN_STAGES, STAGE_META } from "@/lib/deal-meta";
import { addNote, convertToClient, moveDeal, sendBookingLink } from "../actions";

export function StageControl({ dealId, stage }: { dealId: string; stage: DealStage }) {
  const { run, pending, toast } = useAction();
  const [losing, setLosing] = useState(false);
  const [reason, setReason] = useState("");
  if (stage === "WON") return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {toast}
      <select
        value={stage}
        disabled={pending}
        onChange={(e) => run(() => moveDeal(dealId, e.target.value as DealStage))}
        className={`${inputBase} w-auto py-1.5`}
        aria-label="Stage"
      >
        {[...OPEN_STAGES, ...(stage === "LOST" ? (["LOST"] as const) : [])].map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
      </select>
      {stage !== "LOST" &&
        (losing ? (
          <span className="flex items-center gap-2">
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why was it lost?" className={`${inputBase} w-56 py-1.5`} />
            <Button variant="secondary" disabled={pending || !reason.trim()} onClick={() => run(() => moveDeal(dealId, "LOST", reason), () => setLosing(false))}>Mark lost</Button>
            <Button variant="ghost" onClick={() => setLosing(false)}>Cancel</Button>
          </span>
        ) : (
          <Button variant="ghost" className="text-danger" onClick={() => setLosing(true)}>Mark as lost</Button>
        ))}
    </div>
  );
}

export function ConvertButton({ dealId, name }: { dealId: string; name: string }) {
  const { run, pending, toast } = useAction();
  return (
    <>
      {toast}
      <Button
        disabled={pending}
        onClick={() => {
          if (confirm(`Convert ${name} into a client? This marks the deal as Won and moves its tasks under the new client.`)) run(() => convertToClient(dealId));
        }}
      >
        Convert to client
      </Button>
    </>
  );
}

export function NoteForm({ dealId }: { dealId: string }) {
  const { run, pending, toast } = useAction();
  const [text, setText] = useState("");
  return (
    <div className="space-y-2">
      {toast}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Add a note: call summary, next steps…" className={`${inputClass} resize-y`} />
      <Button variant="secondary" disabled={pending || !text.trim()} onClick={() => run(() => addNote(dealId, text), () => setText(""))}>Add note</Button>
    </div>
  );
}

export function SendLinkForm({ dealId, links, hasEmail }: { dealId: string; links: { id: string; title: string; host: string }[]; hasEmail: boolean }) {
  const { run, pending, toast } = useAction();
  const [linkId, setLinkId] = useState(links[0]?.id ?? "");
  const [sent, setSent] = useState(false);
  if (!hasEmail) return <p className="text-xs text-muted">Add an email address to send a booking link.</p>;
  if (!links.length) return <p className="text-xs text-muted">No booking links yet. Create one under Booking Links.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {toast}
      <select value={linkId} onChange={(e) => setLinkId(e.target.value)} className={`${inputBase} w-auto py-1.5`}>
        {links.map((l) => <option key={l.id} value={l.id}>{l.title} ({l.host})</option>)}
      </select>
      <Button variant="secondary" disabled={pending} onClick={() => run(() => sendBookingLink(dealId, linkId), () => setSent(true))}>
        {pending ? "Sending…" : "Email booking link"}
      </Button>
      {sent && <span className="text-xs text-success">Queued, see the activity log for delivery.</span>}
    </div>
  );
}
