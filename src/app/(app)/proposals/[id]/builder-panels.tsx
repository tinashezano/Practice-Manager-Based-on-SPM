"use client";

import type { BillingType } from "@prisma/client";
import { Bookmark, Check, Copy, Plus, TextAlignCenter, TextAlignEnd, TextAlignStart, Trash2, TriangleAlert, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { packageTotals } from "@/components/proposal/document";
import { useAction } from "@/components/tasks/use-action";
import { inputClass } from "@/components/ui";
import { formatRand, parseRand } from "@/lib/money";
import {
  ELEMENTS, FONTS, MERGE_FIELDS, isBlocking, mergeFields, type Block, type BlockOf, type DocLine, type Issue, type MergeValues, type PackageSnapshot, type ProposalDoc,
} from "@/lib/proposal-doc";
import { addCustomLine, addPackageLines, addServiceLine, removeLine, updateLine, uploadProposalAsset } from "../actions";

export type Option = { id: string; name: string; priceCents?: number; billingType?: BillingType };
export type TemplateRow = { id: string; name: string; isDefault: boolean; doc: ProposalDoc };
export type LibraryRow = { id: string; name: string; block: Block };

export async function upload(file: File, kind: "image" | "document") {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("kind", kind);
  const r = await uploadProposalAsset(fd);
  return r.ok ? r : { error: r.error };
}

// ---------- Small building blocks ----------

/** A labelled setting. `group` is for several controls (buttons, checkboxes), which can't sit inside a <label>. */
export function Field({ label, children, hint, group }: { label: string; children: React.ReactNode; hint?: string; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block text-xs font-medium text-muted">
      <span className="mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block font-normal">{hint}</span>}
    </Tag>
  );
}

export function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" /> {label}
    </label>
  );
}

export function SmallBtn({ onClick, disabled, danger, children, title }: { onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className={`flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs hover:bg-background disabled:opacity-40 ${danger ? "text-danger" : ""}`}>
      {children}
    </button>
  );
}

function AlignPicker({ value, onChange }: { value: "left" | "center" | "right"; onChange: (v: "left" | "center" | "right") => void }) {
  const opts = [["left", TextAlignStart], ["center", TextAlignCenter], ["right", TextAlignEnd]] as const;
  return (
    <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
      {opts.map(([v, Icon]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-label={`Align ${v}`} className={`rounded-md p-1.5 ${value === v ? "bg-brand-soft text-brand" : "text-muted hover:text-foreground"}`}><Icon size={15} /></button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-16" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={title} className={`w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-background" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function ImagePicker({ fileId, onChange, disabled, round }: { fileId: string | null; onChange: (id: string | null) => void; disabled?: boolean; round?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {fileId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/assets/${fileId}`} alt="" className={`h-14 w-14 border border-border bg-white object-contain p-1 ${round ? "rounded-full" : "rounded-lg"}`} />
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border text-[11px] text-muted">None</span>
      )}
      {!disabled && (
        <>
          <SmallBtn onClick={() => ref.current?.click()} disabled={busy}><Upload size={13} /> {busy ? "Uploading…" : fileId ? "Change" : "Upload"}</SmallBtn>
          {fileId && <SmallBtn onClick={() => onChange(null)}><X size={13} /> Remove</SmallBtn>}
          <input
            ref={ref}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusy(true);
              const r = await upload(f, "image");
              setBusy(false);
              if ("error" in r) alert(r.error);
              else onChange(r.id);
            }}
          />
        </>
      )}
    </div>
  );
}

// ---------- Block properties ----------

export function PropertiesPanel(props: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveToLibrary: () => void;
  proposalId: string;
  lines: DocLine[];
  vatRate: number;
  services: Option[];
  packages: Option[];
  firmPackages: PackageSnapshot[];
}) {
  const { block, onChange } = props;
  const meta = ELEMENTS.find((e) => e.type === block.type)!;
  const set = <T extends Block>(patch: Partial<T>) => onChange(patch as Partial<Block>);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{meta.label}</h2>
        <p className="text-xs text-muted">{meta.hint}</p>
      </div>

      {block.type === "heading" && (
        <>
          <Field label="Text"><textarea value={block.text} rows={2} onChange={(e) => set<BlockOf<"heading">>({ text: e.target.value })} className={inputClass} /></Field>
          <Field group label="Size">
            <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
              {([1, 2, 3] as const).map((l) => (
                <button key={l} type="button" onClick={() => set<BlockOf<"heading">>({ level: l })} className={`rounded-md px-3 py-1 text-xs font-semibold ${block.level === l ? "bg-brand-soft text-brand" : "text-muted"}`}>H{l}</button>
              ))}
            </div>
          </Field>
          <Field group label="Alignment"><AlignPicker value={block.align} onChange={(align) => set<BlockOf<"heading">>({ align })} /></Field>
        </>
      )}
      {block.type === "text" && <p className="rounded-lg bg-background px-3 py-2.5 text-xs text-muted">Click into the text on the page and use the toolbar above it, like in Word. Use <strong>Variables</strong> to add details that fill in by themselves.</p>}
      {block.type === "image" && (
        <>
          <Field group label="Picture"><ImagePicker fileId={block.fileId} onChange={(fileId) => set<BlockOf<"image">>({ fileId })} /></Field>
          <Field label={`Width: ${block.width}%`}><input type="range" min={10} max={100} step={5} value={block.width} onChange={(e) => set<BlockOf<"image">>({ width: Number(e.target.value) })} className="w-full accent-[var(--brand)]" /></Field>
          <Field group label="Alignment"><AlignPicker value={block.align} onChange={(align) => set<BlockOf<"image">>({ align })} /></Field>
          <Field label="Caption (optional)"><input value={block.caption} onChange={(e) => set<BlockOf<"image">>({ caption: e.target.value })} className={inputClass} /></Field>
        </>
      )}
      {"label" in block && (
        <Field label="Label" hint="Variables like {{client}} work here too."><input value={block.label} onChange={(e) => set({ label: e.target.value } as Partial<Block>)} className={inputClass} /></Field>
      )}
      {block.type === "textField" && (
        <>
          <Field label="Placeholder"><input value={block.placeholder} onChange={(e) => set<BlockOf<"textField">>({ placeholder: e.target.value })} className={inputClass} /></Field>
          <Toggle label="Several lines" checked={block.multiline} onChange={(multiline) => set<BlockOf<"textField">>({ multiline })} />
        </>
      )}
      {block.type === "date" && <Toggle label="Fill in the signing date automatically" checked={block.autoToday} onChange={(autoToday) => set<BlockOf<"date">>({ autoToday })} />}
      {block.type === "radio" && (
        <Field group label="Options">
          <div className="space-y-1.5">
            {block.options.map((o, i) => (
              <div key={i} className="flex gap-1.5">
                <input value={o} onChange={(e) => set<BlockOf<"radio">>({ options: block.options.map((x, j) => (j === i ? e.target.value : x)) })} className={inputClass} aria-label={`Option ${i + 1}`} />
                <button type="button" disabled={block.options.length < 2} onClick={() => set<BlockOf<"radio">>({ options: block.options.filter((_, j) => j !== i) })} className="text-muted hover:text-danger disabled:opacity-30" aria-label="Remove option"><Trash2 size={14} /></button>
              </div>
            ))}
            {block.options.length < 20 && <SmallBtn onClick={() => set<BlockOf<"radio">>({ options: [...block.options, `Option ${block.options.length + 1}`] })}><Plus size={13} /> Add option</SmallBtn>}
          </div>
        </Field>
      )}
      {"required" in block && <Toggle label={block.type === "packages" ? "Client must choose a package" : "Required"} checked={block.required} onChange={(required) => set({ required } as Partial<Block>)} />}

      {block.type === "pricingTable" && (
        <>
          <Field label="Table heading"><input value={block.title} onChange={(e) => set<BlockOf<"pricingTable">>({ title: e.target.value })} className={inputClass} /></Field>
          <Toggle label="Show VAT" checked={block.showVat} onChange={(showVat) => set<BlockOf<"pricingTable">>({ showVat })} />
          <Toggle label="Show descriptions" checked={block.showDescriptions} onChange={(showDescriptions) => set<BlockOf<"pricingTable">>({ showDescriptions })} />
          <div className="border-t border-border pt-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Services on this proposal</h3>
            <LinesPanel id={props.proposalId} lines={props.lines} vat={props.vatRate} services={props.services} packages={props.packages} />
          </div>
        </>
      )}
      {block.type === "packages" && (
        <>
          <Field label="Heading"><input value={block.title} onChange={(e) => set<BlockOf<"packages">>({ title: e.target.value })} className={inputClass} /></Field>
          <Field group label="Packages the client can choose from" hint="The client picks one when signing; its services are added to the proposal. Prices are copied when you tick a package.">
            <div className="space-y-1.5">
              {props.firmPackages.map((fp) => {
                const on = block.packages.some((p) => p.id === fp.id);
                const t = packageTotals(fp, props.vatRate);
                return (
                  <label key={fp.id} className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && block.packages.length >= 6}
                      onChange={(e) => set<BlockOf<"packages">>({ packages: e.target.checked ? [...block.packages, fp] : block.packages.filter((p) => p.id !== fp.id) })}
                    />
                    <span className="flex-1">{fp.name}</span>
                    <span className="text-xs text-muted">{t.monthly ? `${formatRand(t.monthly)}/mo` : formatRand(t.onceOff)}</span>
                  </label>
                );
              })}
              {!props.firmPackages.length && <p className="text-xs text-muted">No packages yet. Create them under Proposals → Packages.</p>}
            </div>
          </Field>
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <SmallBtn onClick={props.onDuplicate}><Copy size={13} /> Duplicate</SmallBtn>
        <SmallBtn onClick={props.onSaveToLibrary}><Bookmark size={13} /> Save to library</SmallBtn>
        <SmallBtn onClick={props.onDelete} danger><Trash2 size={13} /> Delete</SmallBtn>
      </div>
    </div>
  );
}

// ---------- Services on the proposal ----------

function LinesPanel({ id, lines, vat, services, packages }: { id: string; lines: DocLine[]; vat: number; services: Option[]; packages: Option[] }) {
  const { run, pending, toast } = useAction();
  return (
    <div className="space-y-2">
      {toast}
      {lines.map((l) => <LineCard key={`${l.id}-${l.unitPriceCents}-${l.quantity}-${l.name}-${l.description}`} line={l} vat={vat} />)}
      {!lines.length && <p className="rounded-lg border border-dashed border-border bg-white py-4 text-center text-xs text-muted">No services yet.</p>}
      <select value="" disabled={pending} onChange={(e) => e.target.value && run(() => addServiceLine(id, e.target.value))} className={inputClass} aria-label="Add service">
        <option value="">+ Add a service from your list…</option>
        {services.map((s) => <option key={s.id} value={s.id}>{s.name}: {formatRand(s.priceCents ?? 0)}{s.billingType === "MONTHLY" ? "/mo" : ""}</option>)}
      </select>
      {packages.length > 0 && (
        <select value="" disabled={pending} onChange={(e) => e.target.value && run(() => addPackageLines(id, e.target.value))} className={inputClass} aria-label="Add package services">
          <option value="">+ Add all services of a package…</option>
          {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <div className="flex gap-2">
        <SmallBtn onClick={() => run(() => addCustomLine(id, "ONCE_OFF"))} disabled={pending}><Plus size={13} /> Custom once-off</SmallBtn>
        <SmallBtn onClick={() => run(() => addCustomLine(id, "MONTHLY"))} disabled={pending}><Plus size={13} /> Custom monthly</SmallBtn>
      </div>
    </div>
  );
}

function LineCard({ line, vat }: { line: DocLine; vat: number }) {
  const { run, toast } = useAction();
  const save = (patch: Parameters<typeof updateLine>[1]) => run(() => updateLine(line.id, patch));
  const ex = line.quantity * line.unitPriceCents;
  const total = ex + (line.taxable ? Math.round((ex * vat) / 100) : 0);
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-white p-2.5">
      {toast}
      <div className="flex gap-1.5">
        <input defaultValue={line.name} onBlur={(e) => e.target.value.trim() && e.target.value !== line.name && save({ name: e.target.value })} className={`${inputClass} py-1 text-sm font-medium`} aria-label="Service name" />
        <button type="button" onClick={() => run(() => removeLine(line.id))} className="text-muted hover:text-danger" aria-label={`Remove ${line.name}`}><Trash2 size={14} /></button>
      </div>
      <textarea defaultValue={line.description ?? ""} rows={2} placeholder="Breakdown (details shown to the client)" onBlur={(e) => e.target.value !== (line.description ?? "") && save({ description: e.target.value || null })} className={`${inputClass} py-1 text-xs`} aria-label="Description" />
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <select value={line.billingType} onChange={(e) => save({ billingType: e.target.value as BillingType })} className="h-7 rounded-md border border-border bg-white px-1.5" aria-label="Billing">
          <option value="ONCE_OFF">Once-off</option>
          <option value="MONTHLY">Monthly</option>
        </select>
        <input type="number" min={1} defaultValue={line.quantity} onBlur={(e) => Number(e.target.value) !== line.quantity && save({ quantity: Math.max(1, Number(e.target.value) || 1) })} className="h-7 w-12 rounded-md border border-border px-1.5 text-right" aria-label="Quantity" />
        <span className="text-muted">× R</span>
        <input
          defaultValue={(line.unitPriceCents / 100).toFixed(2)}
          onBlur={(e) => {
            const c = parseRand(e.target.value);
            if (c === null) return alert("Enter a valid price, e.g. 2500 or 2500.50");
            if (c !== line.unitPriceCents) save({ price: e.target.value });
          }}
          className="h-7 w-20 rounded-md border border-border px-1.5 text-right"
          aria-label="Unit price excl. VAT"
        />
        <label className="flex items-center gap-1 text-muted"><input type="checkbox" checked={line.taxable} onChange={(e) => save({ taxable: e.target.checked })} /> VAT</label>
        <span className="ml-auto font-semibold">{formatRand(total)}</span>
      </div>
    </div>
  );
}

// ---------- Dialogs ----------

const ACCENTS = ["#4f46e5", "#375dfb", "#0f766e", "#15803d", "#b45309", "#be123c", "#7c3aed", "#1f2937"];

export function HeaderFooterModal({ doc, setDoc, onClose }: { doc: ProposalDoc; setDoc: (fn: (d: ProposalDoc) => ProposalDoc) => void; onClose: () => void }) {
  const h = doc.header;
  const f = doc.footer;
  const setH = (patch: Partial<ProposalDoc["header"]>) => setDoc((d) => ({ ...d, header: { ...d.header, ...patch } }));
  const setF = (patch: Partial<ProposalDoc["footer"]>) => setDoc((d) => ({ ...d, footer: { ...d.footer, ...patch } }));
  return (
    <Modal title="Header & Footer" onClose={onClose}>
      <section className="space-y-3">
        <Toggle label="Show a header on every page" checked={h.enabled} onChange={(enabled) => setH({ enabled })} />
        {h.enabled && (
          <>
            <Field group label="Logo"><ImagePicker fileId={h.logoFileId} onChange={(logoFileId) => setH({ logoFileId })} /></Field>
            <Field label="Header text"><input value={h.text} onChange={(e) => setH({ text: e.target.value })} className={inputClass} /></Field>
            <Field group label="Layout"><AlignPicker value={h.align} onChange={(align) => setH({ align })} /></Field>
            <Toggle label="Also show on the first page" checked={h.showOnFirstPage} onChange={(showOnFirstPage) => setH({ showOnFirstPage })} />
          </>
        )}
      </section>
      <section className="space-y-3 border-t border-border pt-4">
        <Toggle label="Show a footer on every page" checked={f.enabled} onChange={(enabled) => setF({ enabled })} />
        {f.enabled && (
          <>
            <Field label="Footer text"><input value={f.text} onChange={(e) => setF({ text: e.target.value })} className={inputClass} /></Field>
            <Toggle label="Page numbers (Page 1 of 3)" checked={f.pageNumbers} onChange={(pageNumbers) => setF({ pageNumbers })} />
          </>
        )}
      </section>
      <section className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Style</h3>
        <Field group label="Accent colour">
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((c) => (
              <button key={c} type="button" title={c} onClick={() => setDoc((d) => ({ ...d, theme: { ...d.theme, color: c } }))} className={`h-7 w-7 rounded-md border ${doc.theme.color === c ? "ring-2 ring-brand ring-offset-2" : "border-black/10"}`} style={{ background: c }} />
            ))}
            <input type="color" value={doc.theme.color} onChange={(e) => setDoc((d) => ({ ...d, theme: { ...d.theme, color: e.target.value } }))} className="h-7 w-10 cursor-pointer" aria-label="Custom accent colour" />
          </div>
        </Field>
        <Field label="Document font">
          <select value={doc.theme.font} onChange={(e) => setDoc((d) => ({ ...d, theme: { ...d.theme, font: e.target.value as ProposalDoc["theme"]["font"] } }))} className={inputClass}>
            {Object.entries(FONTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
      </section>
    </Modal>
  );
}

export function TemplatesModal({ templates, canManage, onApply, onSave, onSetDefault, onDelete, onClose }: {
  templates: TemplateRow[];
  canManage: boolean;
  onApply: (doc: ProposalDoc | null) => void;
  onSave: (name: string, makeDefault: boolean) => void;
  onSetDefault: (id: string | null) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  return (
    <Modal title="Templates" onClose={onClose} wide>
      <p className="text-sm text-muted">Applying a template replaces the pages, header, footer and email of this proposal. Its services and prices stay as they are.</p>
      <ul className="divide-y divide-border rounded-xl border border-border">
        <li className="flex items-center gap-3 px-4 py-3 text-sm">
          <span className="flex-1"><span className="font-medium">Built-in layout</span><span className="block text-xs text-muted">Cover, services & pricing, terms with signature</span></span>
          <SmallBtn onClick={() => onApply(null)}>Apply</SmallBtn>
          {canManage && !templates.some((t) => t.isDefault) ? <span className="text-xs text-success">Default</span> : canManage && <SmallBtn onClick={() => onSetDefault(null)}>Make default</SmallBtn>}
        </li>
        {templates.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="flex-1">
              <span className="font-medium">{t.name}</span>
              <span className="block text-xs text-muted">{t.doc.pages.length} page{t.doc.pages.length === 1 ? "" : "s"} · {t.doc.pages.reduce((n, p) => n + p.blocks.length, 0)} blocks</span>
            </span>
            <SmallBtn onClick={() => onApply(t.doc)}>Apply</SmallBtn>
            {t.isDefault ? <span className="inline-flex items-center gap-1 text-xs text-success"><Check size={12} /> Default</span> : canManage && <SmallBtn onClick={() => onSetDefault(t.id)}>Make default</SmallBtn>}
            {canManage && <button onClick={() => confirm(`Delete the template "${t.name}"?`) && onDelete(t.id)} className="text-muted hover:text-danger" aria-label={`Delete ${t.name}`}><Trash2 size={15} /></button>}
          </li>
        ))}
      </ul>
      <div className="space-y-2 rounded-xl bg-background p-4">
        <h3 className="text-sm font-semibold">Save this proposal as a template</h3>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly bookkeeping proposal" className={inputClass} aria-label="Template name" />
          <button disabled={name.trim().length < 2} onClick={() => { onSave(name.trim(), makeDefault); setName(""); }} className="shrink-0 rounded-lg bg-brand px-4 text-sm font-medium text-white disabled:opacity-50">Save</button>
        </div>
        {canManage && <Toggle label="Use it for all new proposals" checked={makeDefault} onChange={setMakeDefault} />}
      </div>
    </Modal>
  );
}

export function LibraryModal({ library, onInsert, onDelete, onClose }: { library: LibraryRow[]; onInsert: (b: Block) => void; onDelete: (id: string) => void; onClose: () => void }) {
  return (
    <Modal title="Library" onClose={onClose}>
      <p className="text-sm text-muted">Reusable blocks: your standard terms, team bio, payment details. Save any block here from its settings, then insert it into any proposal.</p>
      {library.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {library.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1"><span className="font-medium">{l.name}</span><span className="block text-xs text-muted">{ELEMENTS.find((e) => e.type === l.block.type)?.label}</span></span>
              <SmallBtn onClick={() => onInsert(l.block)}><Plus size={13} /> Insert</SmallBtn>
              <button onClick={() => confirm(`Delete "${l.name}" from the library?`) && onDelete(l.id)} className="text-muted hover:text-danger" aria-label={`Delete ${l.name}`}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted">Nothing saved yet.</p>
      )}
    </Modal>
  );
}

export function VariablesModal({ values, onInsert, onClose }: { values: MergeValues; onInsert: (key: string) => string; onClose: () => void }) {
  const [done, setDone] = useState<string | null>(null);
  return (
    <Modal title="Variables" onClose={onClose}>
      <p className="text-sm text-muted">Variables fill in by themselves on the client&apos;s copy. Click one to add it where your cursor is (or copy it to paste anywhere).</p>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {MERGE_FIELDS.map((f) => (
          <li key={f.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <code className="w-40 shrink-0 text-xs text-brand">{`{{${f.key}}}`}</code>
            <span className="flex-1"><span className="block">{f.label}</span><span className="block text-xs text-muted">{values[f.key] || "—"}</span></span>
            <SmallBtn onClick={() => setDone(`${f.key}:${onInsert(f.key)}`)}>{done?.startsWith(`${f.key}:`) ? done.split(":")[1] : "Insert"}</SmallBtn>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export function SendModal({ doc, setDoc, to, values, issues, sending, isDraft, onSend, onClose }: {
  doc: ProposalDoc;
  setDoc: (fn: (d: ProposalDoc) => ProposalDoc) => void;
  to: string | null;
  values: MergeValues;
  issues: Issue[];
  sending: boolean;
  isDraft: boolean;
  onSend: () => void;
  onClose: () => void;
}) {
  const blocking = issues.filter(isBlocking);
  return (
    <Modal title={isDraft ? "Send proposal" : "Resend proposal"} onClose={onClose} wide>
      {issues.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {issues.map((i) => <li key={i.message} className="flex items-start gap-2"><TriangleAlert size={15} className="mt-0.5 shrink-0" /> {i.message}{isBlocking(i) ? " (fix before sending)" : ""}</li>)}
        </ul>
      )}
      <Field label="To"><input value={to ?? "No email on the lead"} disabled className={inputClass} /></Field>
      <Field label="Subject" hint={`Preview: ${mergeFields(doc.email.subject, values, false)}`}>
        <input value={doc.email.subject} onChange={(e) => setDoc((d) => ({ ...d, email: { ...d.email, subject: e.target.value } }))} className={inputClass} />
      </Field>
      <Field label="Message" hint="Put {{proposalButton}} on its own line where the “View your proposal” button goes. Sent from your Gmail.">
        <textarea value={doc.email.body} rows={11} onChange={(e) => setDoc((d) => ({ ...d, email: { ...d.email, body: e.target.value } }))} className={`${inputClass} font-mono text-[13px]`} />
      </Field>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
        <button onClick={onSend} disabled={sending || blocking.length > 0 || !to} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{sending ? "Sending…" : isDraft ? "Send now" : "Resend now"}</button>
      </div>
    </Modal>
  );
}

export function DetailsModal({ title, validUntil, startDate, locked, onChange, onClose }: { title: string; validUntil: string; startDate: string | null; locked: boolean; onChange: (patch: { title?: string; validUntil?: string; startDate?: string | null }) => void; onClose: () => void }) {
  return (
    <Modal title="Proposal details" onClose={onClose}>
      <Field label="Title"><input value={title} disabled={locked} onChange={(e) => onChange({ title: e.target.value })} className={inputClass} /></Field>
      <Field label="Valid until"><input type="date" value={validUntil} disabled={locked} onChange={(e) => onChange({ validUntil: e.target.value })} className={inputClass} /></Field>
      <Field group label="Services start">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" disabled={locked} checked={!startDate} onChange={() => onChange({ startDate: null })} /> On acceptance</label>
          <label className="flex items-center gap-1.5"><input type="radio" disabled={locked} checked={!!startDate} onChange={() => onChange({ startDate: validUntil })} /> On a date</label>
        </div>
        {startDate && <input type="date" value={startDate} disabled={locked} onChange={(e) => onChange({ startDate: e.target.value || null })} className={`${inputClass} mt-2`} />}
      </Field>
      <p className="text-xs text-muted">Monthly retainers are charged from one month after the start date.</p>
    </Modal>
  );
}
