import { Check, PenLine } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { computeTotals, dueNow, formatRand, monthlyTotal } from "@/lib/money";
import { FONTS, mergeFields, mergeValues, type Block, type BlockOf, type DocContext, type DocLine, type DocPage, type MergeValues, type PackageSnapshot, type ProposalDoc, type Responses } from "@/lib/proposal-doc";

// Renders the proposal: A4 pages of blocks with header and footer. Shared by
// the builder canvas, the staff preview / PDF and the client's page, so all
// three always match.

export function themeStyle(doc: ProposalDoc): React.CSSProperties {
  return { "--p-accent": doc.theme.color, fontFamily: FONTS[doc.theme.font].css } as React.CSSProperties;
}

export const SHEET = { portrait: { w: 794, h: 1123 }, landscape: { w: 1123, h: 794 } };

/** One A4 sheet with the document's header and footer. */
export function Sheet({ page, index, total, doc, values, children, className = "" }: { page: DocPage; index: number; total: number; doc: ProposalDoc; values: MergeValues; children: React.ReactNode; className?: string }) {
  const size = SHEET[page.orientation];
  const showHeader = doc.header.enabled && (index > 0 || doc.header.showOnFirstPage);
  return (
    <section
      id={`page-${page.id}`}
      className={`proposal-sheet mx-auto flex flex-col bg-white shadow-[0_1px_3px_rgba(16,24,40,0.08),0_8px_24px_rgba(16,24,40,0.06)] ${page.orientation === "landscape" ? "sheet-landscape" : ""} ${className}`}
      style={{ width: `min(${size.w}px, 100%)`, minHeight: size.h }}
    >
      {showHeader && (
        <header className={`flex items-center gap-3 border-b border-[#eceef3] px-6 py-4 text-xs text-[#6b7090] sm:px-14 ${doc.header.align === "center" ? "justify-center" : doc.header.align === "right" ? "justify-end" : "justify-start"}`}>
          {doc.header.logoFileId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/assets/${doc.header.logoFileId}`} alt="" className="h-9 max-w-[140px] object-contain" />
          ) : null}
          {doc.header.text && <span className="font-medium">{mergeFields(doc.header.text, values, false)}</span>}
        </header>
      )}
      <div className="flex-1 space-y-4 px-6 py-8 sm:px-14 sm:py-10">{children}</div>
      {doc.footer.enabled && (
        <footer className="flex items-center justify-between gap-3 border-t border-[#eceef3] px-6 py-3 text-[11px] text-[#8a8ea8] sm:px-14">
          <span>{mergeFields(doc.footer.text, values, false)}</span>
          {doc.footer.pageNumbers && <span>Page {index + 1} of {total}</span>}
        </footer>
      )}
    </section>
  );
}

const ALIGN = { left: "text-left", center: "text-center", right: "text-right" } as const;

export function HeadingView({ block, values }: { block: BlockOf<"heading">; values: MergeValues }) {
  const cls = `${ALIGN[block.align]} font-semibold tracking-tight text-[#111827]`;
  const text = mergeFields(block.text, values, false);
  if (block.level === 1) return <h1 className={`${cls} text-[28px] leading-tight`}>{text}</h1>;
  if (block.level === 2) return <h2 className={`${cls} text-[21px]`}>{text}</h2>;
  return <h3 className={`${cls} text-base`}>{text}</h3>;
}

export function RichHtml({ html, values }: { html: string; values: MergeValues }) {
  // html was sanitised when saved; merge values are escaped.
  return <div className="doc-content" dangerouslySetInnerHTML={{ __html: mergeFields(html, values) }} />;
}

export function ImageView({ block, placeholder }: { block: BlockOf<"image">; placeholder?: React.ReactNode }) {
  if (!block.fileId) return placeholder ? <>{placeholder}</> : null;
  return (
    <figure className={`flex flex-col ${block.align === "center" ? "items-center" : block.align === "right" ? "items-end" : "items-start"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/assets/${block.fileId}`} alt={block.caption} style={{ width: `${block.width}%` }} className="rounded-md" />
      {block.caption && <figcaption className="mt-1.5 text-xs text-[#6b7090]">{block.caption}</figcaption>}
    </figure>
  );
}

export function PricingTable({ block, lines, vatRate }: { block: BlockOf<"pricingTable">; lines: DocLine[]; vatRate: number }) {
  const t = computeTotals(lines, vatRate);
  const vat = block.showVat && vatRate > 0;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left">
              <th className="border border-[#9fd3dc] px-3 py-2 font-semibold">{block.title}</th>
              <th className="w-28 border border-[#9fd3dc] px-3 py-2 text-center font-semibold">Fee</th>
              <th className="w-16 border border-[#9fd3dc] px-3 py-2 text-center font-semibold">QTY</th>
              <th className="w-28 border border-[#9fd3dc] px-3 py-2 text-center font-semibold">Total Fee</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="border border-[#9fd3dc] px-3 py-2.5">
                  <div className="font-medium text-[#111827]">{l.name}</div>
                  {block.showDescriptions && l.description && <div className="mt-1 whitespace-pre-wrap text-xs text-[#6b7090]">{l.description}</div>}
                </td>
                <td className="border border-[#9fd3dc] px-3 py-2.5 text-center text-[#4b5563]">{formatRand(l.unitPriceCents)}<div className="text-[11px] text-[#9ca3af]">{l.billingType === "MONTHLY" ? "/ Monthly" : "/ Once-off"}</div></td>
                <td className="border border-[#9fd3dc] px-3 py-2.5 text-center">{l.quantity}</td>
                <td className="border border-[#9fd3dc] px-3 py-2.5 text-center">{formatRand(l.quantity * l.unitPriceCents)}</td>
              </tr>
            ))}
            {!lines.length && (
              <tr><td colSpan={4} className="border border-[#9fd3dc] px-3 py-6 text-center text-xs italic text-[#9ca3af]">No services yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <table className="ml-auto w-full max-w-[260px] border-collapse text-xs">
        <tbody>
          <TotalRow label="Total Exc. VAT" value={formatRand(t.onceOffExVat + t.monthlyExVat)} />
          {vat && <TotalRow label={`VAT (${vatRate}%)`} value={formatRand(t.onceOffVat + t.monthlyVat)} />}
          <TotalRow label={vat ? "Total Inc. VAT" : "Total"} value={formatRand(t.onceOffExVat + t.onceOffVat + monthlyTotal(t))} strong />
          {t.monthlyExVat > 0 && <TotalRow label="Of which monthly" value={`${formatRand(monthlyTotal(t))} /mo`} />}
          <TotalRow label="Due on acceptance" value={formatRand(dueNow(t))} strong accent />
        </tbody>
      </table>
    </div>
  );
}

function TotalRow({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <tr className={strong ? "font-semibold" : "text-[#4b5563]"}>
      <td className="border border-[#9fd3dc] px-2.5 py-1.5">{label}</td>
      <td className="border border-[#9fd3dc] px-2.5 py-1.5 text-right" style={accent ? { color: "var(--p-accent)" } : undefined}>{value}</td>
    </tr>
  );
}

export function packageTotals(pkg: PackageSnapshot, vatRate: number) {
  const t = computeTotals(pkg.items, vatRate);
  return { onceOff: t.onceOffExVat + t.onceOffVat, monthly: monthlyTotal(t) };
}

export function PackagesView({ block, vatRate, selected, onSelect, emptyHint }: { block: BlockOf<"packages">; vatRate: number; selected?: string | null; onSelect?: (id: string) => void; emptyHint?: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold text-[#111827]">{block.title}</h3>
      {!block.packages.length ? (
        <div className="rounded-lg bg-[#f7f8fa] px-4 py-8 text-center text-sm text-[#6b7090]">{emptyHint ?? "No packages available in this group"}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {block.packages.map((p) => {
            const t = packageTotals(p, vatRate);
            const on = selected === p.id;
            const Tag = onSelect ? "button" : "div";
            return (
              <Tag
                key={p.id}
                type={onSelect ? "button" : undefined}
                onClick={onSelect ? () => onSelect(p.id) : undefined}
                className={`rounded-xl border-2 p-4 text-left transition ${on ? "bg-[color-mix(in_srgb,var(--p-accent)_6%,white)]" : "border-[#e5e7eb]"} ${onSelect ? "hover:border-[color:var(--p-accent)]" : ""}`}
                style={on ? { borderColor: "var(--p-accent)" } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-[#111827]">{p.name}</div>
                  {on && <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: "var(--p-accent)" }}><Check size={13} /></span>}
                </div>
                {p.description && <p className="mt-1 text-xs text-[#6b7090]">{p.description}</p>}
                <ul className="mt-2 space-y-0.5 text-xs text-[#4b5563]">
                  {p.items.map((i, n) => <li key={n}>• {i.name}{i.quantity > 1 ? ` × ${i.quantity}` : ""}</li>)}
                </ul>
                <div className="mt-3 text-sm font-semibold" style={{ color: "var(--p-accent)" }}>
                  {t.monthly ? `${formatRand(t.monthly)} /mo` : formatRand(t.onceOff)}
                  {t.monthly > 0 && t.onceOff > 0 && <span className="font-normal text-[#6b7090]"> + {formatRand(t.onceOff)} once-off</span>}
                </div>
                <div className="text-[11px] text-[#9ca3af]">{vatRate ? "incl. VAT" : ""}</div>
              </Tag>
            );
          })}
        </div>
      )}
    </div>
  );
}

const fieldLabel = "mb-1.5 block text-[13px] font-medium text-[#374151]";
const req = (b: { required?: boolean }) => (b.required ? <span className="text-[#dc2626]"> *</span> : null);

/** A form field as a blank placeholder (builder) or with the client's answer (after signing). */
export function FieldView({ block, values, answer }: { block: Block; values: MergeValues; answer?: unknown }) {
  const label = "label" in block ? mergeFields(block.label, values, false) : "";
  switch (block.type) {
    case "signature": {
      const a = answer as { name?: string; image?: string } | undefined;
      return (
        <div className="max-w-sm">
          <span className={fieldLabel}>{label}{req(block)}</span>
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[#cbd5e1] bg-[#fafbfc]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {a?.image ? <img src={a.image} alt="Signature" className="max-h-20" /> : <span className="inline-flex items-center gap-1.5 text-xs text-[#9ca3af]"><PenLine size={14} /> Sign here</span>}
          </div>
          <div className="mt-1 border-t border-[#111827] pt-1 text-xs text-[#4b5563]">{a?.name ?? "Full name"}</div>
        </div>
      );
    }
    case "initials": {
      const img = typeof answer === "string" ? answer : null;
      return (
        <div className="w-40">
          <span className={fieldLabel}>{label}{req(block)}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-[#cbd5e1] bg-[#fafbfc]">{img ? <img src={img} alt="Initials" className="max-h-14" /> : <span className="text-xs text-[#9ca3af]">Initials</span>}</div>
        </div>
      );
    }
    case "textField":
      return (
        <div>
          <span className={fieldLabel}>{label}{req(block)}</span>
          <div className={`rounded-lg border border-[#d1d5db] px-3 py-2 text-sm ${answer ? "text-[#111827]" : "text-[#9ca3af]"} ${block.multiline ? "min-h-20 whitespace-pre-wrap" : ""}`}>{(answer as string) || block.placeholder || " "}</div>
        </div>
      );
    case "date":
      return (
        <div className="max-w-xs">
          <span className={fieldLabel}>{label}{req(block)}</span>
          <div className={`rounded-lg border border-[#d1d5db] px-3 py-2 text-sm ${answer ? "text-[#111827]" : "text-[#9ca3af]"}`}>{answer ? formatDate(answer as string, { day: "numeric", month: "long", year: "numeric" }) : block.autoToday ? "Filled in when signed" : "dd/mm/yyyy"}</div>
        </div>
      );
    case "checkbox":
      return (
        <div className="flex items-start gap-2 text-sm text-[#374151]">
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${answer === true ? "border-transparent text-white" : "border-[#9ca3af]"}`} style={answer === true ? { background: "var(--p-accent)" } : undefined}>{answer === true && <Check size={12} />}</span>
          <span>{label}{req(block)}</span>
        </div>
      );
    case "radio":
      return (
        <div>
          <span className={fieldLabel}>{label}{req(block)}</span>
          <div className="space-y-1.5">
            {block.options.map((o) => (
              <div key={o} className="flex items-center gap-2 text-sm text-[#374151]">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#9ca3af]">{answer === o && <span className="h-2 w-2 rounded-full" style={{ background: "var(--p-accent)" }} />}</span>
                {mergeFields(o, values, false)}
              </div>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}

/** Any block in read-only form. `field` overrides how form fields (and packages) render, e.g. to make them fillable. */
export function BlockView({ block, values, lines, vatRate, responses, field, imagePlaceholder }: { block: Block; values: MergeValues; lines: DocLine[]; vatRate: number; responses?: Responses | null; field?: (b: Block) => React.ReactNode; imagePlaceholder?: React.ReactNode }) {
  switch (block.type) {
    case "heading": return <HeadingView block={block} values={values} />;
    case "text": return <RichHtml html={block.html} values={values} />;
    case "image": return <ImageView block={block} placeholder={imagePlaceholder} />;
    case "divider": return <hr className="border-0 border-t border-[#e5e7eb]" />;
    case "pricingTable": return <PricingTable block={block} lines={lines} vatRate={vatRate} />;
    case "packages": return field ? <>{field(block)}</> : <PackagesView block={block} vatRate={vatRate} selected={responses?.[block.id] as string | undefined} />;
    default: return field ? <>{field(block)}</> : <FieldView block={block} values={values} answer={responses?.[block.id]} />;
  }
}


/** The whole document, page after page (client page, preview and PDF). */
export function DocumentView({ doc, ctx, lines = ctx.lines, responses, field, after }: { doc: ProposalDoc; ctx: DocContext; lines?: DocLine[]; responses?: Responses | null; field?: (b: Block) => React.ReactNode; after?: React.ReactNode }) {
  const values = mergeValues(ctx, lines);
  const pages = doc.pages.filter((p, i) => p.blocks.length || i === 0);
  return (
    <div className="proposal-doc space-y-6" style={themeStyle(doc)}>
      {pages.map((page, i) => (
        <Sheet key={page.id} page={page} index={i} total={pages.length} doc={doc} values={values}>
          {page.blocks.map((b) => (
            <div key={b.id}><BlockView block={b} values={values} lines={lines} vatRate={ctx.vatRate} responses={responses} field={field} /></div>
          ))}
          {i === pages.length - 1 && after}
        </Sheet>
      ))}
    </div>
  );
}
