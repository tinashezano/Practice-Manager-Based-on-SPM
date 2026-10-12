"use client";

import { Copy, ExternalLink, Eye, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { BillingType } from "@prisma/client";
import { useAction } from "@/components/tasks/use-action";
import { Button, inputBase, inputClass } from "@/components/ui";
import { formatRand, parseRand } from "@/lib/money";
import {
  addCustomLine, addPackageLines, addServiceLine, deleteDraft, markDeclined, recordPayment, removeLine, send, updateLine, updateProposalDetails, uploadSigned, withdraw,
} from "../actions";

type Line = { id: string; name: string; description: string | null; billingType: BillingType; quantity: number; unitPriceCents: number; taxable: boolean };

export function DetailsForm({ id, initial, locked }: { id: string; initial: { title: string; introduction: string; terms: string; validUntil: string; startDate: string }; locked: boolean }) {
  const { run, pending, toast } = useAction();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setV({ ...v, [k]: e.target.value }); setSaved(false); };
  return (
    <div className="space-y-3">
      {toast}
      <input value={v.title} onChange={set("title")} disabled={locked} className={`${inputClass} text-base font-semibold`} aria-label="Title" />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-muted">Valid until<input type="date" value={v.validUntil} onChange={set("validUntil")} disabled={locked} className={`${inputClass} mt-1`} /></label>
        <label className="text-xs font-medium text-muted">Retainers start<input type="date" value={v.startDate} onChange={set("startDate")} disabled={locked} className={`${inputClass} mt-1`} /></label>
      </div>
      <label className="block text-xs font-medium text-muted">Introduction<textarea value={v.introduction} onChange={set("introduction")} disabled={locked} rows={5} className={`${inputClass} mt-1`} /></label>
      <details>
        <summary className="cursor-pointer text-xs font-medium text-muted">Terms</summary>
        <textarea value={v.terms} onChange={set("terms")} disabled={locked} rows={10} className={`${inputClass} mt-2 text-xs`} />
      </details>
      {!locked && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={pending || !dirty} onClick={() => run(() => updateProposalDetails(id, { ...v, introduction: v.introduction || null, terms: v.terms || null, startDate: v.startDate || null }), () => setSaved(true))}>
            {pending ? "Saving…" : "Save details"}
          </Button>
          {saved && !dirty && <span className="text-xs text-success">Saved</span>}
          {dirty && <span className="text-xs text-warning">Unsaved changes</span>}
        </div>
      )}
    </div>
  );
}

function LineRow({ line, locked, vat }: { line: Line; locked: boolean; vat: number }) {
  const { run, toast } = useAction();
  const save = (patch: Parameters<typeof updateLine>[1]) => run(() => updateLine(line.id, patch));
  const ex = line.quantity * line.unitPriceCents;
  const total = ex + (line.taxable ? Math.round((ex * vat) / 100) : 0);
  if (locked) {
    return (
      <tr className="border-b border-border last:border-0 align-top">
        <td className="px-3 py-2.5"><div className="font-medium">{line.name}</div>{line.description && <div className="text-xs text-muted">{line.description}</div>}</td>
        <td className="px-3 py-2.5 text-xs">{line.billingType === "MONTHLY" ? "Monthly" : "Once-off"}</td>
        <td className="px-3 py-2.5 text-right">{line.quantity}</td>
        <td className="px-3 py-2.5 text-right">{formatRand(line.unitPriceCents)}</td>
        <td className="px-3 py-2.5 text-right font-medium">{formatRand(total)}</td>
        <td />
      </tr>
    );
  }
  const k = `${line.id}-${line.unitPriceCents}-${line.quantity}-${line.name}`;
  return (
    <tr className="border-b border-border last:border-0 align-top">
      {toast}
      <td className="space-y-1 px-3 py-2">
        <input key={`n${k}`} defaultValue={line.name} onBlur={(e) => e.target.value.trim() && e.target.value !== line.name && save({ name: e.target.value })} className={`${inputClass} py-1 font-medium`} aria-label="Service name" />
        <textarea key={`d${k}`} defaultValue={line.description ?? ""} rows={1} placeholder="Description (optional)" onBlur={(e) => e.target.value !== (line.description ?? "") && save({ description: e.target.value || null })} className={`${inputClass} py-1 text-xs`} />
      </td>
      <td className="px-3 py-2">
        <select value={line.billingType} onChange={(e) => save({ billingType: e.target.value as BillingType })} className={`${inputBase} py-1 text-xs`} aria-label="Billing">
          <option value="ONCE_OFF">Once-off</option>
          <option value="MONTHLY">Monthly</option>
        </select>
        <label className="mt-1 flex items-center gap-1 text-[11px] text-muted"><input type="checkbox" checked={line.taxable} onChange={(e) => save({ taxable: e.target.checked })} /> VAT</label>
      </td>
      <td className="px-3 py-2"><input key={`q${k}`} type="number" min={1} defaultValue={line.quantity} onBlur={(e) => Number(e.target.value) !== line.quantity && save({ quantity: Math.max(1, Number(e.target.value) || 1) })} className={`${inputBase} w-16 py-1 text-right`} aria-label="Quantity" /></td>
      <td className="px-3 py-2">
        <input
          key={`p${k}`}
          defaultValue={(line.unitPriceCents / 100).toFixed(2)}
          onBlur={(e) => {
            const c = parseRand(e.target.value);
            if (c === null) return alert("Enter a valid price, e.g. 2500 or 2500.50");
            if (c !== line.unitPriceCents) save({ price: e.target.value });
          }}
          className={`${inputBase} w-28 py-1 text-right`}
          aria-label="Unit price excl. VAT"
        />
      </td>
      <td className="px-3 py-2.5 text-right font-medium">{formatRand(total)}</td>
      <td className="px-2 py-2.5"><button onClick={() => run(() => removeLine(line.id))} className="text-muted hover:text-danger" aria-label={`Remove ${line.name}`}><Trash2 size={15} /></button></td>
    </tr>
  );
}

export function LinesEditor({ id, lines, locked, vat, services, packages }: { id: string; lines: Line[]; locked: boolean; vat: number; services: { id: string; name: string; priceCents: number; billingType: BillingType }[]; packages: { id: string; name: string }[] }) {
  const { run, pending, toast } = useAction();
  return (
    <div>
      {toast}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Service</th>
              <th className="px-3 py-2 font-medium">Billing</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Price excl. VAT</th>
              <th className="px-3 py-2 text-right font-medium">Total{vat ? " incl. VAT" : ""}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => <LineRow key={l.id} line={l} locked={locked} vat={vat} />)}
            {!lines.length && <tr><td colSpan={6} className="py-8 text-center text-muted">No services yet. Add some below.</td></tr>}
          </tbody>
        </table>
      </div>
      {!locked && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value="" disabled={pending} onChange={(e) => e.target.value && run(() => addServiceLine(id, e.target.value))} className={`${inputBase} py-1.5`} aria-label="Add service">
            <option value="">+ Add service…</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}: {formatRand(s.priceCents)}{s.billingType === "MONTHLY" ? "/mo" : ""}</option>)}
          </select>
          {packages.length > 0 && (
            <select value="" disabled={pending} onChange={(e) => e.target.value && run(() => addPackageLines(id, e.target.value))} className={`${inputBase} py-1.5`} aria-label="Add package">
              <option value="">+ Add package…</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <Button variant="ghost" disabled={pending} onClick={() => run(() => addCustomLine(id, "ONCE_OFF"))}>+ Custom once-off</Button>
          <Button variant="ghost" disabled={pending} onClick={() => run(() => addCustomLine(id, "MONTHLY"))}>+ Custom monthly</Button>
        </div>
      )}
    </div>
  );
}

export function ProposalActions({ id, status, display, publicUrl, canRecordPayment, hasEmail, paid }: { id: string; status: string; display: string; publicUrl: string; canRecordPayment: boolean; hasEmail: boolean; paid: boolean }) {
  const { run, pending, toast } = useAction();
  const [copied, setCopied] = useState(false);
  const [upload, setUpload] = useState(false);
  const [eft, setEft] = useState(false);
  const [note, setNote] = useState("");
  const open = ["DRAFT", "SENT", "VIEWED"].includes(status);

  return (
    <div className="space-y-2">
      {toast}
      {open && display !== "EXPIRED" && (
        <Button className="w-full" disabled={pending || !hasEmail} onClick={() => run(() => send(id))} title={hasEmail ? undefined : "Add an email on the lead first"}>
          {status === "DRAFT" ? "Send to client" : "Resend email"}
        </Button>
      )}
      <Link href={`/proposals/${id}/preview`} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm hover:bg-background"><Eye size={14} /> Preview</Link>
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
      {status === "DRAFT" && (
        <Button variant="ghost" className="w-full text-danger" onClick={() => confirm("Delete this draft?") && run(() => deleteDraft(id))}><Trash2 size={14} /> Delete draft</Button>
      )}
    </div>
  );
}
