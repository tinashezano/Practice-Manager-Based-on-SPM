"use client";

import { Lock } from "lucide-react";
import { useState, useTransition } from "react";
import { DocumentView, PackagesView } from "@/components/proposal/document";
import { SignaturePad } from "@/components/proposal/signature-pad";
import { formatDate } from "@/lib/dates";
import { computeTotals, dueNow, formatRand, monthlyTotal } from "@/lib/money";
import { allBlocks, linesWithPackage, mergeFields, mergeValues, type Block, type DocContext, type ProposalDoc, type Responses } from "@/lib/proposal-doc";
import { accept } from "../actions";

const input = "w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[color:var(--p-accent)] focus:outline-none";
const lbl = "mb-1.5 block text-[13px] font-medium text-[#374151]";

/** The client's copy: fields they fill in, the package they choose, and the accept button. */
export function FillableProposal({ token, doc, ctx }: { token: string; doc: ProposalDoc; ctx: DocContext }) {
  const [responses, setResponses] = useState<Responses>({});
  const [typedName, setTypedName] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (id: string, v: unknown) => setResponses((r) => ({ ...r, [id]: v }));

  const pkgBlock = allBlocks(doc).find((b) => b.type === "packages");
  const chosen = pkgBlock ? (responses[pkgBlock.id] as string | undefined) : undefined;
  const lines = linesWithPackage(ctx.lines, doc, chosen);
  const values = mergeValues(ctx, lines);
  const t = computeTotals(lines, ctx.vatRate);
  const hasSignature = allBlocks(doc).some((b) => b.type === "signature");

  const field = (b: Block): React.ReactNode => {
    const label = "label" in b ? mergeFields(b.label, values, false) : "";
    const req = "required" in b && b.required ? <span className="text-[#dc2626]"> *</span> : null;
    switch (b.type) {
      case "signature": {
        const v = (responses[b.id] ?? {}) as { name?: string; image?: string | null };
        return (
          <div className="max-w-md space-y-2">
            <span className={lbl}>{label}{req}</span>
            <SignaturePad onChange={(image) => set(b.id, { ...v, image })} />
            <input value={v.name ?? ""} onChange={(e) => set(b.id, { ...v, name: e.target.value })} placeholder="Type your full name" className={input} aria-label="Full name" />
          </div>
        );
      }
      case "initials":
        return (
          <div className="w-48">
            <span className={lbl}>{label}{req}</span>
            <SignaturePad height={70} label="Initials" onChange={(image) => set(b.id, image)} />
          </div>
        );
      case "textField":
        return (
          <label className="block">
            <span className={lbl}>{label}{req}</span>
            {b.multiline ? (
              <textarea rows={4} value={(responses[b.id] as string) ?? ""} placeholder={b.placeholder} onChange={(e) => set(b.id, e.target.value)} className={input} />
            ) : (
              <input value={(responses[b.id] as string) ?? ""} placeholder={b.placeholder} onChange={(e) => set(b.id, e.target.value)} className={input} />
            )}
          </label>
        );
      case "date":
        return (
          <label className="block max-w-xs">
            <span className={lbl}>{label}{req}</span>
            {b.autoToday ? (
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-sm text-[#4b5563]">{formatDate(ctx.today, { day: "numeric", month: "long", year: "numeric" })}</div>
            ) : (
              <input type="date" value={(responses[b.id] as string) ?? ""} onChange={(e) => set(b.id, e.target.value)} className={input} />
            )}
          </label>
        );
      case "checkbox":
        return (
          <label className="flex items-start gap-2 text-sm text-[#374151]">
            <input type="checkbox" checked={responses[b.id] === true} onChange={(e) => set(b.id, e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--p-accent)]" />
            <span>{label}{req}</span>
          </label>
        );
      case "radio":
        return (
          <fieldset>
            <legend className={lbl}>{label}{req}</legend>
            <div className="space-y-1.5">
              {b.options.map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm text-[#374151]">
                  <input type="radio" name={b.id} checked={responses[b.id] === o} onChange={() => set(b.id, o)} className="h-4 w-4 accent-[var(--p-accent)]" />
                  {mergeFields(o, values, false)}
                </label>
              ))}
            </div>
          </fieldset>
        );
      case "packages":
        return <PackagesView block={b} vatRate={ctx.vatRate} selected={responses[b.id] as string | undefined} onSelect={(id) => set(b.id, id)} />;
      default:
        return null;
    }
  };

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await accept(token, { responses, typedName, agree });
      if (r?.error) setError(r.error);
    });

  return (
    <DocumentView
      doc={doc}
      ctx={ctx}
      lines={lines}
      field={field}
      after={
        <div className="mt-8 space-y-3 rounded-xl border-2 p-5 print:hidden" style={{ borderColor: "var(--p-accent)" }}>
          <h2 className="text-base font-semibold text-[#111827]">Accept this proposal</h2>
          <p className="text-sm text-[#4b5563]">
            Due on acceptance: <strong>{formatRand(dueNow(t))}</strong>
            {t.monthlyExVat > 0 && <> (includes the first month, then {formatRand(monthlyTotal(t))} monthly)</>}
          </p>
          {!hasSignature && (
            <label className="block max-w-md">
              <span className={lbl}>Type your full name to sign</span>
              <input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder={ctx.contactName} className={input} />
            </label>
          )}
          <label className="flex items-start gap-2 text-xs text-[#4b5563]">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--p-accent)]" />
            I have read this proposal and its terms, I accept them on behalf of the business named above, and I&apos;m authorised to do so. I agree that my signature above (or typed name) is my electronic signature.
          </label>
          {error && <p className="text-sm text-[#dc2626]">{error}</p>}
          <button onClick={submit} disabled={pending} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--p-accent)" }}>
            {pending ? "Signing…" : "Accept and sign"}
          </button>
          <p className="flex items-center gap-1.5 text-[11px] text-[#9ca3af]"><Lock size={11} /> Your IP address and the time are recorded with your signature.</p>
        </div>
      }
    />
  );
}
