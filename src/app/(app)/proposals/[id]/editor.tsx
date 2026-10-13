"use client";

import { Copy, ExternalLink, Upload } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/tasks/use-action";
import { Button, inputClass } from "@/components/ui";
import { markDeclined, recordPayment, uploadSigned, withdraw } from "../actions";

// Actions for a proposal after it's sent: share the link, record a signature
// or EFT payment received outside the app, decline or withdraw.
export function StatusActions({ id, status, publicUrl, canRecordPayment, paid }: { id: string; status: string; publicUrl: string; canRecordPayment: boolean; paid: boolean }) {
  const { run, pending, toast } = useAction();
  const [copied, setCopied] = useState(false);
  const [upload, setUpload] = useState(false);
  const [eft, setEft] = useState(false);
  const [note, setNote] = useState("");
  const open = ["DRAFT", "SENT", "VIEWED"].includes(status);

  return (
    <div className="space-y-2">
      {toast}
      {status !== "DRAFT" && (
        <div className="flex gap-2">
          <button onClick={async () => { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-background">
            <Copy size={14} /> {copied ? "Copied" : "Copy client link"}
          </button>
          <a href={publicUrl} target="_blank" className="flex items-center rounded-lg border border-border px-3 py-2 hover:bg-background" aria-label="Open client link"><ExternalLink size={14} /></a>
        </div>
      )}

      {open && (
        upload ? (
          <form action={(fd) => run(() => uploadSigned(id, fd), () => setUpload(false))} className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-xs text-muted">Upload the proposal signed on paper or in DocuSign. It will be marked as signed.</p>
            <input type="file" name="file" accept="application/pdf" required className="text-xs" />
            <div className="flex gap-2"><Button disabled={pending}>Upload</Button><Button type="button" variant="ghost" onClick={() => setUpload(false)}>Cancel</Button></div>
          </form>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => setUpload(true)}><Upload size={14} /> Upload signed PDF</Button>
        )
      )}

      {canRecordPayment && !paid && ["SENT", "VIEWED", "SIGNED"].includes(status) && (
        eft ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-xs text-muted">Record a payment received outside Paystack (e.g. EFT). Monthly fees will then be billed outside Paystack too.</p>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="EFT reference / note" className={inputClass} />
            <div className="flex gap-2"><Button disabled={pending || !note.trim()} onClick={() => run(() => recordPayment(id, note), () => setEft(false))}>Mark as paid</Button><Button variant="ghost" onClick={() => setEft(false)}>Cancel</Button></div>
          </div>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => setEft(true)}>Record EFT payment</Button>
        )
      )}

      {open && status !== "DRAFT" && (
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" className="flex-1 text-xs" onClick={() => { const r = prompt("Why did they decline? (optional)"); if (r !== null) run(() => markDeclined(id, r)); }}>Mark declined</Button>
          <Button variant="ghost" className="flex-1 text-xs" onClick={() => confirm("Withdraw this proposal? The client link will stop working.") && run(() => withdraw(id))}>Withdraw</Button>
        </div>
      )}
    </div>
  );
}
