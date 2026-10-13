"use client";

import type { BillingType } from "@prisma/client";
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, ChevronLeft, ChevronRight, Eye, EyeOff, FileDown, FileText, Plus, Save, Send, Trash2, TriangleAlert, Upload, X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CoverPage, PageFrame, SectionExtras, SectionHeading, mergeValues, pageAnchor, themeStyle, type DocContext, type DocLine } from "@/components/proposal/document";
import { DocEditorContent, Ribbon, useDocEditor } from "@/components/proposal/rich-editor";
import { useAction } from "@/components/tasks/use-action";
import { inputClass } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { computeTotals, dueNow, formatRand, monthlyTotal, parseRand } from "@/lib/money";
import {
  FONTS, KIND_LABELS, MERGE_FIELDS, REQUIRED_KINDS, docIssues, mergeFields, newSection, snippet, termLabel, type DocSection, type FontKey, type ProposalDoc,
} from "@/lib/proposal-doc";
import {
  addCustomLine, addPackageLines, addServiceLine, deleteDraft, removeLine, saveAsTemplate, saveProposal, send, updateLine, uploadProposalAsset,
} from "../actions";

type State = { title: string; validUntil: string; startDate: string | null; doc: ProposalDoc };
type Selected = "general" | "cover" | "theme" | "email" | "status" | string; // or a section id
type Option = { id: string; name: string; priceCents?: number; billingType?: BillingType };

export type BuilderProps = {
  id: string;
  number: string;
  status: string;
  statusLabel: string;
  locked: boolean;
  expired: boolean;
  backHref: string;
  initial: State;
  ctx: DocContext;
  hasEmail: boolean;
  services: Option[];
  packages: Option[];
  canTemplate: boolean;
  updatedAt: string;
  paymentMode: string;
  statusPanel: React.ReactNode;
};

const ACCENTS = ["#375dfb", "#4f46e5", "#0f766e", "#15803d", "#b45309", "#be123c", "#7c3aed", "#1f2937"];
const BACKGROUNDS = ["#efe8dc", "#f3f4f6", "#eef2ff", "#ecfdf5", "#fdf2f8", "#ffffff"];
const TERMS = [null, 1, 3, 6, 12, 24, 36] as const;
const OPTIONAL: string[] = ["documents", "perks", "custom", "nextStep"];

const savedFmt = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "numeric", minute: "2-digit", day: "numeric", month: "short", year: "numeric" });

async function upload(file: File, kind: "image" | "document") {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("kind", kind);
  const r = await uploadProposalAsset(fd);
  return r.ok ? r : { error: r.error };
}

export function ProposalBuilder(props: BuilderProps) {
  const { id, locked, ctx } = props;
  const [state, setState] = useState<State>(props.initial);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [save, setSave] = useState<{ status: "saved" | "dirty" | "saving" | "error"; at: string; error?: string }>({ status: "saved", at: props.updatedAt });
  const [showIssues, setShowIssues] = useState(false);
  const { run, pending, toast } = useAction();
  const [sending, startSend] = useTransition();
  const stateRef = useRef(state);
  stateRef.current = state;
  const savedJson = useRef(JSON.stringify(props.initial));
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));

  const doc = state.doc;
  const live: DocContext = useMemo(() => ({ ...ctx, title: state.title, validUntil: state.validUntil, startDate: state.startDate }), [ctx, state.title, state.validUntil, state.startDate]);
  const issues = docIssues(doc, { lineCount: ctx.lines.length, hasEmail: props.hasEmail, expired: props.expired });

  // ---------- Autosave ----------
  const flush = useCallback(() => {
    chain.current = chain.current.then(async () => {
      const snapshot = JSON.stringify(stateRef.current);
      if (snapshot === savedJson.current) return true;
      setSave((s) => ({ ...s, status: "saving" }));
      const r = await saveProposal(id, stateRef.current);
      if (!r.ok) {
        setSave((s) => ({ ...s, status: "error", error: r.error }));
        return false;
      }
      savedJson.current = snapshot;
      setSave({ status: JSON.stringify(stateRef.current) === snapshot ? "saved" : "dirty", at: r.savedAt ?? new Date().toISOString() });
      return true;
    });
    return chain.current;
  }, [id]);

  useEffect(() => {
    if (locked || JSON.stringify(state) === savedJson.current) return;
    setSave((s) => (s.status === "dirty" ? s : { ...s, status: "dirty" }));
    const t = setTimeout(() => void flush(), 900);
    return () => clearTimeout(t);
  }, [state, flush, locked]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(stateRef.current) !== savedJson.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // ---------- Document edits ----------
  const setDoc = (fn: (d: ProposalDoc) => ProposalDoc) => setState((s) => ({ ...s, doc: fn(s.doc) }));
  const patchSection = (sid: string, patch: Partial<DocSection>) => setDoc((d) => ({ ...d, sections: d.sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)) }));
  const moveSection = (sid: string, dir: -1 | 1) =>
    setDoc((d) => {
      const i = d.sections.findIndex((s) => s.id === sid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.sections.length) return d;
      const next = [...d.sections];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { ...d, sections: next };
    });
  const addSection = () => {
    const s = newSection("custom", "New section");
    setDoc((d) => {
      const ty = d.sections.findIndex((x) => x.kind === "thankYou");
      const next = [...d.sections];
      next.splice(ty < 0 ? next.length : ty, 0, s);
      return { ...d, sections: next };
    });
    setSelected(s.id);
  };
  const removeSection = (sid: string) => {
    if (!confirm("Delete this section?")) return;
    setDoc((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== sid) }));
    setSelected(null);
  };

  const section = doc.sections.find((s) => s.id === selected) ?? null;
  const visible = doc.sections.filter((s) => !s.hidden);
  const servicesSection = doc.sections.find((s) => s.kind === "services")!;
  const pricingSection = doc.sections.find((s) => s.kind === "pricing")!;
  const stage2 = doc.sections.filter((s) => s.kind !== "services" && s.kind !== "pricing");

  // Which page the canvas shows.
  const canvasKey: string = section ? section.id : selected === "email" ? "email" : "cover";

  const doSend = () =>
    startSend(async () => {
      if (!(await flush())) return;
      if (issues.some((i) => i.message === "No services added" || i.message.startsWith("The lead has no email"))) {
        setShowIssues(true);
        return;
      }
      if (!confirm(props.status === "DRAFT" ? `Email this proposal to the client now?` : "Resend the proposal email?")) return;
      run(() => send(id));
    });

  const t = computeTotals(ctx.lines, ctx.vatRate);
  const { term, start } = termLabel(doc.general.termMonths, !state.startDate, formatDate(state.startDate, { day: "numeric", month: "short", year: "numeric" }));

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#f6f6f9]">
      {toast}
      {/* ---------- Top bar ---------- */}
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-white px-4 py-2.5">
        <Link href={props.backHref} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-background" aria-label="Back"><ArrowLeft size={16} /></Link>
        <span className="text-[15px] font-semibold">{locked ? "View Proposal" : "Edit Proposal"}</span>
        <input
          value={state.title}
          onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
          disabled={locked}
          aria-label="Proposal title"
          className="h-9 w-72 rounded-lg border border-border px-3 text-sm focus:border-brand focus:outline-none disabled:bg-background"
        />
        <span className="text-xs text-muted">{props.number}</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className={`text-sm ${props.status === "DRAFT" ? "text-[#f97316]" : "text-brand"}`}>• {props.statusLabel}</span>
          {!locked && (
            <span className={`text-xs ${save.status === "error" ? "text-danger" : "text-muted"}`} title={save.error}>
              {save.status === "saving" ? "Saving…" : save.status === "dirty" ? "Unsaved changes" : save.status === "error" ? `Not saved: ${save.error}` : `Saved ${savedFmt.format(new Date(save.at))}`}
            </span>
          )}
          {!locked && (
            <div className="relative">
              <button
                onClick={() => setShowIssues(!showIssues)}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${issues.length ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
              >
                {issues.length ? <><span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] text-white">{issues.length}</span> issues</> : <><Check size={13} /> Ready</>}
              </button>
              {showIssues && issues.length > 0 && (
                <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-border bg-white p-2 shadow-xl">
                  {issues.map((i) => (
                    <button key={i.message} onClick={() => { setSelected(i.target === "email" ? "email" : i.target); setShowIssues(false); }} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-background">
                      <TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-500" /> {i.message}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <a href={`/proposal-preview/${id}`} target="_blank" className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-background"><Eye size={15} /> Preview</a>
          <a href={`/proposal-preview/${id}?print=1`} target="_blank" className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-background"><FileDown size={15} /> Download PDF</a>
          {props.status === "DRAFT" && (
            <button onClick={() => confirm("Delete this draft proposal?") && run(() => deleteDraft(id))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-red-50 hover:text-danger" aria-label="Delete draft"><Trash2 size={15} /></button>
          )}
          {!locked && (
            <button onClick={() => void flush()} className="flex h-9 items-center gap-1.5 rounded-lg border border-brand px-3 text-sm text-brand hover:bg-brand-soft"><Save size={15} /> {props.status === "DRAFT" ? "Save as Draft" : "Save"}</button>
          )}
          {!locked && props.status !== "WITHDRAWN" && !props.expired && (
            <button onClick={doSend} disabled={sending || pending} className="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60">
              {sending || pending ? "Sending…" : props.status === "DRAFT" ? "Send" : "Resend"} <Send size={14} />
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------- Left panel ---------- */}
        <aside className="w-[460px] shrink-0 overflow-y-auto border-r border-border bg-[#f6f6f9] p-4">
          {selected === null ? (
            <div className="space-y-2.5">
              <Stage n={1} title="Agreement" count={3} />
              <Row done={!!state.title && !!state.validUntil} title="General" summary={<>• {term} • {start}</>} onClick={() => setSelected("general")} />
              <Row done={ctx.lines.length > 0} n={2} title={servicesSection.title} badge={ctx.lines.length ? undefined : "Empty"} summary={ctx.lines.length ? `${ctx.lines.length} service${ctx.lines.length === 1 ? "" : "s"}` : "No services added"} onClick={() => setSelected(servicesSection.id)} />
              <Row done title="Payments" summary={ctx.lines.length ? `${formatRand(dueNow(t))} due on acceptance${t.monthlyExVat ? ` · ${formatRand(monthlyTotal(t))}/mo` : ""}` : "Not required to sign"} onClick={() => setSelected(pricingSection.id)} />

              <Stage n={2} title="Proposal" count={stage2.length + 1} />
              <Row done title="Cover" summary={mergeFields(doc.cover.subtitle, mergeValues(live, doc), false) || "Cover page"} onClick={() => setSelected("cover")} />
              {stage2.map((s) => {
                const done = s.kind === "documents" ? s.files.length > 0 : s.kind === "perks" ? s.perks.length > 0 : !!snippet(s.html).trim();
                const summary = s.kind === "documents" ? (s.files.length ? `${s.files.length} document${s.files.length === 1 ? "" : "s"}` : "No documents added") : s.kind === "perks" ? `${s.perks.length} perks shown to client` : snippet(s.html) || "Empty";
                return <Row key={s.id} done={done} title={s.title} badge={OPTIONAL.includes(s.kind) ? "Optional" : undefined} hidden={s.hidden} summary={summary} onClick={() => setSelected(s.id)} />;
              })}
              {!locked && (
                <button onClick={addSection} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#c7cbe6] py-3 text-sm text-brand hover:bg-white">
                  <Plus size={15} /> Add section
                </button>
              )}

              <Stage n={3} title="Send" count={3} />
              <Row done title="Theme" summary={<span className="inline-flex items-center gap-1.5">Theme color: <span className="inline-block h-3 w-3 rounded-sm" style={{ background: doc.theme.color }} /> {doc.theme.color}</span>} onClick={() => setSelected("theme")} />
              <Row done={!!doc.email.subject && !!doc.email.body} title="Email" summary={mergeFields(doc.email.subject, mergeValues(live, doc), false)} onClick={() => setSelected("email")} />
              <Row done={props.status !== "DRAFT"} title="Status & payments" summary={props.statusLabel} onClick={() => setSelected("status")} />

              {props.canTemplate && !locked && (
                <button
                  onClick={() => confirm("Use this proposal's sections, wording, theme and email as the starting point for all new proposals?") && run(() => saveAsTemplate(id), () => alert("Saved. New proposals will start from this layout."))}
                  className="mt-2 w-full rounded-lg py-2 text-xs text-muted hover:bg-white hover:text-brand"
                >
                  Save this layout as the template for new proposals
                </button>
              )}
            </div>
          ) : (
            <div>
              <button onClick={() => setSelected(null)} className="mb-3 flex items-center gap-1 text-sm text-muted hover:text-brand"><ChevronLeft size={16} /> All sections</button>
              {selected === "general" && (
                <Panel title="General">
                  <Field label="Proposal title"><input value={state.title} disabled={locked} onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))} className={inputClass} /></Field>
                  <Field label="Agreement length">
                    <select value={doc.general.termMonths ?? ""} disabled={locked} onChange={(e) => setDoc((d) => ({ ...d, general: { termMonths: e.target.value ? Number(e.target.value) : null } }))} className={inputClass}>
                      {TERMS.map((m) => <option key={String(m)} value={m ?? ""}>{m ? `${m} month${m === 1 ? "" : "s"}` : "Ongoing (no fixed term)"}</option>)}
                    </select>
                  </Field>
                  <Field label="Services start">
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-1.5"><input type="radio" disabled={locked} checked={!state.startDate} onChange={() => setState((s) => ({ ...s, startDate: null }))} /> On acceptance</label>
                      <label className="flex items-center gap-1.5"><input type="radio" disabled={locked} checked={!!state.startDate} onChange={() => setState((s) => ({ ...s, startDate: s.validUntil }))} /> On a date</label>
                    </div>
                    {state.startDate && <input type="date" value={state.startDate} disabled={locked} onChange={(e) => setState((s) => ({ ...s, startDate: e.target.value || null }))} className={`${inputClass} mt-2`} />}
                  </Field>
                  <Field label="Valid until"><input type="date" value={state.validUntil} disabled={locked} onChange={(e) => setState((s) => ({ ...s, validUntil: e.target.value }))} className={inputClass} /></Field>
                  <p className="text-xs text-muted">Monthly retainers are charged from one month after the start date.</p>
                </Panel>
              )}
              {selected === "cover" && (
                <Panel title="Cover">
                  <Field label="Line above the client's name"><input value={doc.cover.heading} disabled={locked} onChange={(e) => setDoc((d) => ({ ...d, cover: { ...d.cover, heading: e.target.value } }))} className={inputClass} /></Field>
                  <Field label="Subtitle (under the client's name)"><input value={doc.cover.subtitle} disabled={locked} onChange={(e) => setDoc((d) => ({ ...d, cover: { ...d.cover, subtitle: e.target.value } }))} className={inputClass} /></Field>
                  <Field label="Tagline (under your firm name)"><input value={doc.cover.tagline} disabled={locked} placeholder="e.g. Practice proposal" onChange={(e) => setDoc((d) => ({ ...d, cover: { ...d.cover, tagline: e.target.value } }))} className={inputClass} /></Field>
                  <Field label="Curated with care by"><input value={doc.cover.preparedBy} disabled={locked} onChange={(e) => setDoc((d) => ({ ...d, cover: { ...d.cover, preparedBy: e.target.value } }))} className={inputClass} /></Field>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={locked} checked={doc.cover.showLogo} onChange={(e) => setDoc((d) => ({ ...d, cover: { ...d.cover, showLogo: e.target.checked } }))} /> Show logo</label>
                  <FieldHelp />
                </Panel>
              )}
              {selected === "theme" && (
                <Panel title="Theme">
                  <Field label="Theme colour">
                    <div className="flex flex-wrap items-center gap-2">
                      {ACCENTS.map((c) => <Swatch key={c} color={c} active={doc.theme.color === c} disabled={locked} onClick={() => setDoc((d) => ({ ...d, theme: { ...d.theme, color: c } }))} />)}
                      <input type="color" value={doc.theme.color} disabled={locked} onChange={(e) => setDoc((d) => ({ ...d, theme: { ...d.theme, color: e.target.value } }))} className="h-8 w-10 cursor-pointer" aria-label="Custom theme colour" />
                    </div>
                  </Field>
                  <Field label="Page background">
                    <div className="flex flex-wrap items-center gap-2">
                      {BACKGROUNDS.map((c) => <Swatch key={c} color={c} active={doc.theme.background === c} disabled={locked} onClick={() => setDoc((d) => ({ ...d, theme: { ...d.theme, background: c } }))} />)}
                      <input type="color" value={doc.theme.background} disabled={locked} onChange={(e) => setDoc((d) => ({ ...d, theme: { ...d.theme, background: e.target.value } }))} className="h-8 w-10 cursor-pointer" aria-label="Custom background colour" />
                    </div>
                  </Field>
                  <Field label="Font">
                    <select value={doc.theme.font} disabled={locked} onChange={(e) => setDoc((d) => ({ ...d, theme: { ...d.theme, font: e.target.value as FontKey } }))} className={inputClass}>
                      {Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Logo">
                    <LogoPicker fileId={doc.theme.logoFileId} disabled={locked} onChange={(logoFileId) => setDoc((d) => ({ ...d, theme: { ...d.theme, logoFileId } }))} />
                  </Field>
                </Panel>
              )}
              {selected === "email" && (
                <Panel title="Email">
                  <Field label="Subject"><input value={doc.email.subject} disabled={locked} onChange={(e) => setDoc((d) => ({ ...d, email: { ...d.email, subject: e.target.value } }))} className={inputClass} /></Field>
                  <Field label="Message">
                    <textarea value={doc.email.body} disabled={locked} rows={14} onChange={(e) => setDoc((d) => ({ ...d, email: { ...d.email, body: e.target.value } }))} className={`${inputClass} font-mono text-[13px]`} />
                  </Field>
                  <p className="text-xs text-muted">Put <code className="rounded bg-white px-1">{"{{proposalButton}}"}</code> on its own line where the &quot;View your proposal&quot; button should go. The email is sent from your Gmail when you click Send.</p>
                  <FieldHelp onInsert={locked ? undefined : (k) => setDoc((d) => ({ ...d, email: { ...d.email, body: `${d.email.body}{{${k}}}` } }))} />
                </Panel>
              )}
              {selected === "status" && <Panel title="Status & payments">{props.statusPanel}<p className="text-[11px] text-muted">Payments: {props.paymentMode}</p></Panel>}

              {section && (
                <Panel title={KIND_LABELS[section.kind] === section.title ? section.title : `${section.title}`}>
                  <Field label="Page title">
                    <input value={section.title} disabled={locked} onChange={(e) => patchSection(section.id, { title: e.target.value })} className={inputClass} />
                  </Field>
                  {!locked && (
                    <div className="flex flex-wrap gap-2">
                      <SmallBtn onClick={() => moveSection(section.id, -1)} disabled={doc.sections[0]?.id === section.id}><ArrowUp size={13} /> Move up</SmallBtn>
                      <SmallBtn onClick={() => moveSection(section.id, 1)} disabled={doc.sections.at(-1)?.id === section.id}><ArrowDown size={13} /> Move down</SmallBtn>
                      {!REQUIRED_KINDS.includes(section.kind) && (
                        <SmallBtn onClick={() => patchSection(section.id, { hidden: !section.hidden })}>{section.hidden ? <><Eye size={13} /> Show to client</> : <><EyeOff size={13} /> Hide from client</>}</SmallBtn>
                      )}
                      {section.kind === "custom" && <SmallBtn onClick={() => removeSection(section.id)} danger><Trash2 size={13} /> Delete</SmallBtn>}
                    </div>
                  )}
                  {section.hidden && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Hidden: the client won&apos;t see this page.</p>}

                  {section.kind === "services" && <LinesPanel id={id} lines={ctx.lines} locked={locked} vat={ctx.vatRate} services={props.services} packages={props.packages} />}
                  {section.kind === "pricing" && (
                    <div className="space-y-1.5 rounded-xl bg-white p-4 text-sm">
                      {t.onceOffExVat > 0 && <div className="flex justify-between"><span className="text-muted">Once-off</span><span>{formatRand(t.onceOffExVat + t.onceOffVat)}</span></div>}
                      {t.monthlyExVat > 0 && <div className="flex justify-between"><span className="text-muted">Monthly</span><span>{formatRand(monthlyTotal(t))}</span></div>}
                      <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Due on acceptance</span><span>{formatRand(dueNow(t))}</span></div>
                      <p className="pt-1 text-xs text-muted">Prices come from the Services section. Type payment notes (e.g. EFT details) on the page →</p>
                    </div>
                  )}
                  {section.kind === "perks" && <PerksPanel section={section} locked={locked} onChange={(perks) => patchSection(section.id, { perks })} />}
                  {section.kind === "documents" && <DocsPanel section={section} locked={locked} onChange={(files) => patchSection(section.id, { files })} />}
                  {section.kind !== "services" && !locked && (
                    <p className="rounded-lg bg-white px-3 py-2.5 text-xs text-muted">Click on the page to type. Use the toolbar like in Word: fonts, sizes, colours, tables, pictures. <strong>Insert field</strong> adds details that fill in by themselves, like the client&apos;s name.</p>
                  )}
                </Panel>
              )}
            </div>
          )}
        </aside>

        {/* ---------- Canvas ---------- */}
        <section className="flex min-w-0 flex-1 flex-col p-4">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-white">
            <nav className="flex shrink-0 justify-center gap-1 overflow-x-auto border-b border-border px-3">
              <Tab active={canvasKey === "cover"} onClick={() => setSelected("cover")}>Cover</Tab>
              {visible.map((s) => <Tab key={s.id} active={canvasKey === s.id} onClick={() => setSelected(s.id)}>{s.title}</Tab>)}
              {section?.hidden && <Tab active onClick={() => {}}><EyeOff size={12} className="mr-1 inline" />{section.title}</Tab>}
              <Tab active={canvasKey === "email"} onClick={() => setSelected("email")}>Email</Tab>
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto" style={{ ...themeStyle(doc), background: doc.theme.background }}>
              {section && section.kind !== "services" ? (
                <RichCanvas key={section.id} section={section} doc={doc} ctx={live} locked={locked} index={visible.findIndex((s) => s.id === section.id) + 1} onHtml={(html) => patchSection(section.id, { html })} />
              ) : section ? (
                <div className="p-6"><PageFrame id={pageAnchor(section.id)}><SectionHeading title={section.title} index={visible.findIndex((s) => s.id === section.id) + 1} /><SectionExtras section={section} ctx={live} doc={doc} position="before" /></PageFrame></div>
              ) : canvasKey === "email" ? (
                <EmailPreview doc={doc} ctx={live} />
              ) : (
                <div className="p-6"><CoverPage doc={doc} ctx={live} onRead="#" /></div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------- Canvas pieces ----------

function RichCanvas({ section, doc, ctx, locked, index, onHtml }: { section: DocSection; doc: ProposalDoc; ctx: DocContext; locked: boolean; index: number; onHtml: (html: string) => void }) {
  const editor = useDocEditor({ html: section.html, editable: !locked, onChange: onHtml, placeholder: "Click here and start typing…" });
  const imageUpload = useCallback(async (file: File) => {
    const r = await upload(file, "image");
    return "error" in r ? { error: r.error } : { url: r.url };
  }, []);
  return (
    <>
      {!locked && (
        <div className="sticky top-0 z-20 border-b border-border bg-white/95 px-3 py-1.5 backdrop-blur">
          <Ribbon editor={editor} onUpload={imageUpload} />
        </div>
      )}
      <div className="p-6">
        <PageFrame id={pageAnchor(section.id)}>
          <SectionHeading title={section.title} index={index > 0 ? index : undefined} />
          <SectionExtras section={section} ctx={ctx} doc={doc} position="before" />
          <div className={locked ? "" : "rounded-lg ring-1 ring-transparent transition focus-within:ring-[color:var(--p-accent)]/30 hover:ring-[#e4e2dc]"}>
            <DocEditorContent editor={editor} />
          </div>
          <SectionExtras section={section} ctx={ctx} doc={doc} position="after" />
        </PageFrame>
      </div>
    </>
  );
}

function EmailPreview({ doc, ctx }: { doc: ProposalDoc; ctx: DocContext }) {
  const v = mergeValues(ctx, doc);
  const body = mergeFields(doc.email.body, v, false);
  const paras = (body.includes("{{proposalButton}}") ? body : `${body}\n\n{{proposalButton}}`).split(/\n{2,}/);
  return (
    <div className="p-6">
      <div className="mx-auto max-w-[620px] overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="border-b border-border px-6 py-4 text-sm">
          <div className="text-muted">To: <span className="text-foreground">{ctx.contactName}</span></div>
          <div className="mt-1 font-semibold">{mergeFields(doc.email.subject, v, false)}</div>
        </div>
        <div className="space-y-3 px-6 py-5 text-[15px] leading-relaxed">
          {paras.map((p, i) =>
            p.trim() === "{{proposalButton}}" ? (
              <span key={i} className="inline-block rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: doc.theme.color }}>View your proposal</span>
            ) : (
              <p key={i} className="whitespace-pre-wrap">{p.trim()}</p>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Left panel pieces ----------

function Stage({ n, title, count }: { n: number; title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="rounded-md border border-border bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wide">STAGE {n}</span>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted">· {count} sections</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function Row({ done, n, title, summary, badge, hidden, onClick }: { done: boolean; n?: number; title: string; summary: React.ReactNode; badge?: string; hidden?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-border bg-white px-4 py-3.5 text-left transition hover:border-[#c7cbe6] hover:shadow-sm">
      {done ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Check size={14} strokeWidth={3} /></span>
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted">{n ?? "!"}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          {title}
          {badge && <span className={`rounded-full border px-2 text-[11px] font-normal ${badge === "Empty" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-border text-muted"}`}>{badge}</span>}
          {hidden && <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted"><EyeOff size={11} /> Hidden</span>}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">{summary}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted" />
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function SmallBtn({ onClick, disabled, danger, children }: { onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs hover:bg-background disabled:opacity-40 ${danger ? "text-danger" : ""}`}>
      {children}
    </button>
  );
}

function Swatch({ color, active, disabled, onClick }: { color: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} title={color} className={`h-8 w-8 rounded-lg border ${active ? "ring-2 ring-brand ring-offset-2" : "border-black/10"}`} style={{ background: color }} />
  );
}

function FieldHelp({ onInsert }: { onInsert?: (key: string) => void }) {
  return (
    <details className="rounded-lg bg-white px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium text-muted">Fields you can use</summary>
      <ul className="mt-2 space-y-1">
        {MERGE_FIELDS.map((f) => (
          <li key={f.key} className="flex items-center justify-between gap-2">
            <code className="text-[11px]">{`{{${f.key}}}`}</code>
            <span className="flex-1 text-muted">{f.label}</span>
            {onInsert && <button type="button" onClick={() => onInsert(f.key)} className="text-brand">Insert</button>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function LogoPicker({ fileId, disabled, onChange }: { fileId: string | null; disabled: boolean; onChange: (id: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {fileId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/assets/${fileId}`} alt="Logo" className="h-14 w-14 rounded-full border border-border bg-white object-contain p-1" />
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-border text-[11px] text-muted">No logo</span>
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

function PerksPanel({ section, locked, onChange }: { section: DocSection; locked: boolean; onChange: (perks: DocSection["perks"]) => void }) {
  const set = (i: number, patch: Partial<DocSection["perks"][number]>) => onChange(section.perks.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="space-y-2">
      {section.perks.map((p, i) => (
        <div key={p.id} className="space-y-1.5 rounded-xl border border-border bg-white p-3">
          <div className="flex gap-2">
            <input value={p.title} disabled={locked} onChange={(e) => set(i, { title: e.target.value })} placeholder="Perk" aria-label="Perk title" className={`${inputClass} font-medium`} />
            {!locked && <button type="button" onClick={() => onChange(section.perks.filter((_, j) => j !== i))} className="text-muted hover:text-danger" aria-label="Remove perk"><Trash2 size={15} /></button>}
          </div>
          <textarea value={p.text} disabled={locked} rows={2} onChange={(e) => set(i, { text: e.target.value })} placeholder="Short description" aria-label="Perk description" className={`${inputClass} text-xs`} />
        </div>
      ))}
      {!locked && section.perks.length < 20 && (
        <SmallBtn onClick={() => onChange([...section.perks, { id: Math.random().toString(36).slice(2, 10), title: "New perk", text: "" }])}><Plus size={13} /> Add perk</SmallBtn>
      )}
    </div>
  );
}

function DocsPanel({ section, locked, onChange }: { section: DocSection; locked: boolean; onChange: (files: DocSection["files"]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      {section.files.map((f) => (
        <div key={f.id} className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
          <FileText size={15} className="text-brand" />
          <a href={`/api/assets/${f.id}`} target="_blank" className="flex-1 truncate hover:underline">{f.name}</a>
          {!locked && <button type="button" onClick={() => onChange(section.files.filter((x) => x.id !== f.id))} className="text-muted hover:text-danger" aria-label={`Remove ${f.name}`}><Trash2 size={14} /></button>}
        </div>
      ))}
      {!section.files.length && <p className="text-xs text-muted">No documents yet. Add brochures, engagement letters or price lists for the client to download.</p>}
      {!locked && (
        <>
          <SmallBtn onClick={() => ref.current?.click()} disabled={busy}><Upload size={13} /> {busy ? "Uploading…" : "Upload document"}</SmallBtn>
          <input
            ref={ref}
            type="file"
            hidden
            accept=".pdf,.docx,.xlsx,image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusy(true);
              const r = await upload(f, "document");
              setBusy(false);
              if ("error" in r) alert(r.error);
              else onChange([...section.files, { id: r.id, name: r.name }]);
            }}
          />
          <p className="text-[11px] text-muted">Anyone with the proposal link can download these.</p>
        </>
      )}
    </div>
  );
}

function LinesPanel({ id, lines, locked, vat, services, packages }: { id: string; lines: DocLine[]; locked: boolean; vat: number; services: Option[]; packages: Option[] }) {
  const { run, pending, toast } = useAction();
  return (
    <div className="space-y-2">
      {toast}
      {lines.map((l) => <LineCard key={`${l.id}-${l.unitPriceCents}-${l.quantity}-${l.name}-${l.description}`} line={l} locked={locked} vat={vat} />)}
      {!lines.length && <p className="rounded-xl border border-dashed border-border bg-white py-6 text-center text-sm text-muted">No services yet. Add one below.</p>}
      {!locked && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <select value="" disabled={pending} onChange={(e) => e.target.value && run(() => addServiceLine(id, e.target.value))} className={`${inputClass} col-span-2`} aria-label="Add service">
            <option value="">+ Add a service from your list…</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}: {formatRand(s.priceCents ?? 0)}{s.billingType === "MONTHLY" ? "/mo" : ""}</option>)}
          </select>
          {packages.length > 0 && (
            <select value="" disabled={pending} onChange={(e) => e.target.value && run(() => addPackageLines(id, e.target.value))} className={`${inputClass} col-span-2`} aria-label="Add package">
              <option value="">+ Add a package…</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <SmallBtn onClick={() => run(() => addCustomLine(id, "ONCE_OFF"))} disabled={pending}><Plus size={13} /> Custom once-off</SmallBtn>
          <SmallBtn onClick={() => run(() => addCustomLine(id, "MONTHLY"))} disabled={pending}><Plus size={13} /> Custom monthly</SmallBtn>
        </div>
      )}
    </div>
  );
}

function LineCard({ line, locked, vat }: { line: DocLine; locked: boolean; vat: number }) {
  const { run, toast } = useAction();
  const save = (patch: Parameters<typeof updateLine>[1]) => run(() => updateLine(line.id, patch));
  const ex = line.quantity * line.unitPriceCents;
  const total = ex + (line.taxable ? Math.round((ex * vat) / 100) : 0);
  return (
    <div className="space-y-2 rounded-xl border border-border bg-white p-3">
      {toast}
      <div className="flex gap-2">
        <input defaultValue={line.name} disabled={locked} onBlur={(e) => e.target.value.trim() && e.target.value !== line.name && save({ name: e.target.value })} className={`${inputClass} font-medium`} aria-label="Service name" />
        {!locked && <button type="button" onClick={() => run(() => removeLine(line.id))} className="text-muted hover:text-danger" aria-label={`Remove ${line.name}`}><Trash2 size={15} /></button>}
      </div>
      <textarea defaultValue={line.description ?? ""} disabled={locked} rows={2} placeholder="What's included (shown to the client)" onBlur={(e) => e.target.value !== (line.description ?? "") && save({ description: e.target.value || null })} className={`${inputClass} text-xs`} aria-label="Description" />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select value={line.billingType} disabled={locked} onChange={(e) => save({ billingType: e.target.value as BillingType })} className="h-8 rounded-lg border border-border bg-white px-2" aria-label="Billing">
          <option value="ONCE_OFF">Once-off</option>
          <option value="MONTHLY">Monthly</option>
        </select>
        <label className="flex items-center gap-1 text-muted">Qty <input type="number" min={1} defaultValue={line.quantity} disabled={locked} onBlur={(e) => Number(e.target.value) !== line.quantity && save({ quantity: Math.max(1, Number(e.target.value) || 1) })} className="h-8 w-14 rounded-lg border border-border px-2 text-right text-foreground" aria-label="Quantity" /></label>
        <label className="flex items-center gap-1 text-muted">
          R
          <input
            defaultValue={(line.unitPriceCents / 100).toFixed(2)}
            disabled={locked}
            onBlur={(e) => {
              const c = parseRand(e.target.value);
              if (c === null) return alert("Enter a valid price, e.g. 2500 or 2500.50");
              if (c !== line.unitPriceCents) save({ price: e.target.value });
            }}
            className="h-8 w-24 rounded-lg border border-border px-2 text-right text-foreground"
            aria-label="Unit price excl. VAT"
          />
        </label>
        <label className="flex items-center gap-1 text-muted"><input type="checkbox" checked={line.taxable} disabled={locked} onChange={(e) => save({ taxable: e.target.checked })} /> VAT</label>
        <span className="ml-auto font-semibold text-foreground">{formatRand(total)}{line.billingType === "MONTHLY" && <span className="font-normal text-muted">/mo</span>}</span>
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`shrink-0 border-b-2 px-3 py-3 text-sm transition ${active ? "border-brand font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"}`}>
      {children}
    </button>
  );
}
