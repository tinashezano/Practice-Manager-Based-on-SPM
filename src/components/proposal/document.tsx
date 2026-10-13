import type { BillingType } from "@prisma/client";
import { CheckCircle2, ChevronRight, FileText } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { computeTotals, dueNow, formatRand, lineVat, monthlyTotal } from "@/lib/money";
import { FONTS, mergeFields, termLabel, type DocSection, type MergeValues, type ProposalDoc } from "@/lib/proposal-doc";

// Renders the proposal document. Shared by the editor canvas, the staff
// preview / PDF and the client's page, so all three always match.

export type DocLine = { id: string; name: string; description: string | null; billingType: BillingType; quantity: number; unitPriceCents: number; taxable: boolean };

export type DocContext = {
  number: string;
  title: string;
  clientName: string;
  contactName: string;
  senderName: string;
  firm: { legalName: string; registrationNumber: string | null; vatNumber: string | null; email: string | null; phone: string | null; address: string | null };
  validUntil: string;
  startDate: string | null;
  issuedAt: string;
  today: string;
  vatRate: number;
  lines: DocLine[];
};

const LONG: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
const SHORT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

export function mergeValues(ctx: DocContext, doc: ProposalDoc): MergeValues {
  const t = computeTotals(ctx.lines, ctx.vatRate);
  const { term } = termLabel(doc.general.termMonths, !ctx.startDate, "");
  return {
    client: ctx.clientName,
    contactName: ctx.contactName,
    contactFirstName: ctx.contactName.split(" ")[0] ?? ctx.contactName,
    firm: ctx.firm.legalName,
    title: ctx.title,
    proposalNumber: ctx.number,
    senderName: ctx.senderName,
    validUntil: formatDate(ctx.validUntil, LONG),
    startDate: ctx.startDate ? formatDate(ctx.startDate, LONG) : "acceptance",
    term,
    dueNow: formatRand(dueNow(t)),
    monthlyTotal: formatRand(monthlyTotal(t)),
    today: formatDate(ctx.today, LONG),
  };
}

export function themeStyle(doc: ProposalDoc): React.CSSProperties {
  return { "--p-accent": doc.theme.color, "--p-bg": doc.theme.background, fontFamily: FONTS[doc.theme.font].css } as React.CSSProperties;
}

export const pageAnchor = (key: string) => `page-${key}`;

/** One page of the document: a paper card on the themed background. */
export function PageFrame({ children, id, narrow = false, className = "" }: { children: React.ReactNode; id?: string; narrow?: boolean; className?: string }) {
  return (
    <section id={id} className={`proposal-page mx-auto w-full scroll-mt-20 rounded-[22px] bg-[#fbfaf7] px-6 py-10 shadow-sm sm:px-12 ${narrow ? "max-w-[520px]" : "max-w-[760px]"} ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeading({ title, index }: { title: string; index?: number }) {
  return (
    <header className="mb-6">
      {index !== undefined && <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--p-accent)" }}>{String(index).padStart(2, "0")}</div>}
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#1b1f3b]">{title}</h2>
      <div className="mt-3 h-[3px] w-10 rounded-full" style={{ background: "var(--p-accent)" }} />
    </header>
  );
}

export function RichHtml({ html, values }: { html: string; values: MergeValues }) {
  // html was sanitised when saved; merge values are escaped.
  return <div className="doc-content" dangerouslySetInnerHTML={{ __html: mergeFields(html, values) }} />;
}

export function CoverPage({ doc, ctx, onRead }: { doc: ProposalDoc; ctx: DocContext; onRead?: string }) {
  const v = mergeValues(ctx, doc);
  const m = (s: string) => mergeFields(s, v, false);
  return (
    <PageFrame id={pageAnchor("cover")} narrow className="flex min-h-[640px] flex-col items-center text-center">
      {doc.cover.showLogo && (
        doc.theme.logoFileId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/assets/${doc.theme.logoFileId}`} alt={ctx.firm.legalName} className="h-16 w-16 rounded-full border border-black/10 bg-white object-contain p-1.5" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-white text-xl font-semibold" style={{ color: "var(--p-accent)" }}>
            {ctx.firm.legalName.charAt(0)}
          </div>
        )
      )}
      <div className="mt-3 text-sm font-semibold text-[#1b1f3b]">{ctx.firm.legalName}</div>
      {doc.cover.tagline && <div className="text-xs italic text-[#6b7090]">{m(doc.cover.tagline)}</div>}

      <div className="mt-12 text-sm italic text-[#3b3f5c]">{m(doc.cover.heading)}</div>
      <h1 className="mt-2 text-4xl font-medium leading-tight tracking-tight text-[#111] sm:text-5xl">{ctx.clientName}</h1>
      <div className="mt-5 flex items-center gap-3" aria-hidden>
        <span className="h-px w-14 bg-[#c9cbd8]" />
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--p-accent)" }} />
        <span className="h-px w-14 bg-[#c9cbd8]" />
      </div>
      <div className="mt-5 text-base italic text-[#3b3f5c]">{m(doc.cover.subtitle)}</div>

      {onRead && (
        <a href={onRead} className="mt-8 inline-flex items-center gap-1.5 rounded-full border px-6 py-2.5 text-sm italic print:hidden" style={{ borderColor: "var(--p-accent)", color: "#1b1f3b" }}>
          Read your proposal <ChevronRight size={14} />
        </a>
      )}
      {doc.cover.preparedBy && <div className="mt-4 text-xs italic text-[#6b7090]">Curated with care by {m(doc.cover.preparedBy)}</div>}

      <div className="mt-auto w-full border-t border-[#d9dae3] pt-5">
        <div className="text-sm italic text-[#1b1f3b]">{ctx.senderName}</div>
        <div className="mt-1 text-xs text-[#6b7090]">
          {ctx.number} · Issued {formatDate(ctx.issuedAt, SHORT)} · Valid until {formatDate(ctx.validUntil, SHORT)}
        </div>
      </div>
    </PageFrame>
  );
}

function ServicesBody({ ctx, doc }: { ctx: DocContext; doc: ProposalDoc }) {
  const { term, start } = termLabel(doc.general.termMonths, !ctx.startDate, formatDate(ctx.startDate, LONG));
  if (!ctx.lines.length) return <p className="text-sm italic text-[#6b7090]">No services added yet.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#6b7090]">{term} agreement · {start}</p>
      {ctx.lines.map((l) => (
        <div key={l.id} className="rounded-xl border border-[#e4e2dc] bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="font-semibold text-[#1b1f3b]">{l.name}{l.quantity > 1 && <span className="font-normal text-[#6b7090]"> × {l.quantity}</span>}</div>
            <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white" style={{ background: "var(--p-accent)" }}>
              {l.billingType === "MONTHLY" ? "Monthly" : "Once-off"}
            </span>
          </div>
          {l.description && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[#4b4f6a]">{l.description}</p>}
        </div>
      ))}
    </div>
  );
}

function PricingTable({ ctx }: { ctx: DocContext }) {
  const t = computeTotals(ctx.lines, ctx.vatRate);
  const vat = ctx.vatRate > 0;
  const groups = (["ONCE_OFF", "MONTHLY"] as const).map((b) => ({ b, lines: ctx.lines.filter((l) => l.billingType === b) })).filter((g) => g.lines.length);
  if (!groups.length) return <p className="text-sm italic text-[#6b7090]">Add services to see pricing.</p>;
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.b}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b7090]">{g.b === "MONTHLY" ? "Monthly retainer" : "Once-off"}</div>
          <div className="overflow-x-auto rounded-xl border border-[#e4e2dc] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e4e2dc] text-left text-xs text-[#6b7090]">
                  <th className="px-4 py-2.5 font-medium">Service</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Price excl. VAT</th>
                  {vat && <th className="px-3 py-2.5 text-right font-medium">VAT</th>}
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {g.lines.map((l) => {
                  const ex = l.quantity * l.unitPriceCents;
                  const v = lineVat(l, ctx.vatRate);
                  return (
                    <tr key={l.id} className="border-b border-[#efeee9] last:border-0">
                      <td className="px-4 py-2.5 font-medium text-[#1b1f3b]">{l.name}</td>
                      <td className="px-3 py-2.5 text-right">{l.quantity}</td>
                      <td className="px-3 py-2.5 text-right">{formatRand(l.unitPriceCents)}</td>
                      {vat && <td className="px-3 py-2.5 text-right text-[#6b7090]">{formatRand(v)}</td>}
                      <td className="px-4 py-2.5 text-right font-medium">{formatRand(ex + v)}{g.b === "MONTHLY" && <span className="text-xs font-normal text-[#6b7090]"> /mo</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div className="ml-auto max-w-sm space-y-1.5 rounded-xl bg-white p-4 text-sm">
        {t.onceOffExVat > 0 && <TotalRow label={`Once-off${vat ? " (incl. VAT)" : ""}`} value={formatRand(t.onceOffExVat + t.onceOffVat)} />}
        {t.monthlyExVat > 0 && <TotalRow label={`Monthly${vat ? " (incl. VAT)" : ""}`} value={`${formatRand(monthlyTotal(t))} /mo`} />}
        {vat && <TotalRow label={`Includes VAT at ${ctx.vatRate}%`} value={formatRand(t.onceOffVat + t.monthlyVat)} muted />}
        <div className="border-t border-[#e4e2dc] pt-2">
          <div className="flex justify-between gap-4 text-base font-semibold"><span>Due on acceptance</span><span style={{ color: "var(--p-accent)" }}>{formatRand(dueNow(t))}</span></div>
          {t.monthlyExVat > 0 && <p className="mt-1 text-xs text-[#6b7090]">Includes the first month, then {formatRand(monthlyTotal(t))} monthly.</p>}
        </div>
      </div>
    </div>
  );
}

function TotalRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return <div className={`flex justify-between gap-4 ${muted ? "text-xs text-[#6b7090]" : ""}`}><span>{label}</span><span>{value}</span></div>;
}

function PerkGrid({ section }: { section: DocSection }) {
  if (!section.perks.length) return null;
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {section.perks.map((p) => (
        <div key={p.id} className="rounded-xl border border-[#e4e2dc] bg-white p-4">
          <div className="flex items-center gap-2 font-semibold text-[#1b1f3b]"><CheckCircle2 size={16} style={{ color: "var(--p-accent)" }} /> {p.title}</div>
          {p.text && <p className="mt-1 text-sm text-[#4b4f6a]">{p.text}</p>}
        </div>
      ))}
    </div>
  );
}

function FileList({ section }: { section: DocSection }) {
  if (!section.files.length) return null;
  return (
    <ul className="mt-5 space-y-2">
      {section.files.map((f) => (
        <li key={f.id}>
          <a href={`/api/assets/${f.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-[#e4e2dc] bg-white px-4 py-3 text-sm font-medium hover:border-[color:var(--p-accent)]">
            <FileText size={16} style={{ color: "var(--p-accent)" }} /> {f.name}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The fixed (non-typed) part of a section that sits around its rich text:
 * the services list, the pricing table, perk cards and document links.
 */
export function SectionExtras({ section, ctx, doc, position }: { section: DocSection; ctx: DocContext; doc: ProposalDoc; position: "before" | "after" }) {
  if (position === "before") {
    if (section.kind === "services") return <ServicesBody ctx={ctx} doc={doc} />;
    if (section.kind === "pricing") return <div className="mb-6"><PricingTable ctx={ctx} /></div>;
    return null;
  }
  if (section.kind === "perks") return <PerkGrid section={section} />;
  if (section.kind === "documents") return <FileList section={section} />;
  return null;
}

/** A section as read by the client (no editing). */
export function SectionPage({ section, ctx, doc, index, after }: { section: DocSection; ctx: DocContext; doc: ProposalDoc; index: number; after?: React.ReactNode }) {
  const values = mergeValues(ctx, doc);
  return (
    <PageFrame id={pageAnchor(section.id)}>
      <SectionHeading title={mergeFields(section.title, values, false)} index={index} />
      <SectionExtras section={section} ctx={ctx} doc={doc} position="before" />
      {section.kind !== "services" && <RichHtml html={section.html} values={values} />}
      <SectionExtras section={section} ctx={ctx} doc={doc} position="after" />
      {after}
    </PageFrame>
  );
}

/** The whole document, page after page (client page, preview and PDF). */
export function ProposalPages({ doc, ctx, after = {}, hideThankYou = false }: { doc: ProposalDoc; ctx: DocContext; after?: Partial<Record<string, React.ReactNode>>; hideThankYou?: boolean }) {
  const visible = doc.sections.filter((s) => !s.hidden && !(hideThankYou && s.kind === "thankYou"));
  return (
    <div className="proposal-doc space-y-6" style={themeStyle(doc)}>
      <CoverPage doc={doc} ctx={ctx} onRead={visible[0] ? `#${pageAnchor(visible[0].id)}` : undefined} />
      {visible.map((s, i) => <SectionPage key={s.id} section={s} ctx={ctx} doc={doc} index={i + 1} after={after[s.kind]} />)}
    </div>
  );
}
