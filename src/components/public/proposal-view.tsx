import type { BillingType } from "@prisma/client";
import { formatDate } from "@/lib/dates";
import { formatRand, lineVat } from "@/lib/money";
import type { ProposalWithLines } from "@/lib/proposals";
import { firstRenewal, totalsOf } from "@/lib/proposals";

type Firm = { legalName: string; registrationNumber: string | null; vatNumber: string | null; email: string | null; phone: string | null; address: string | null };

const SECTION: Record<BillingType, string> = { ONCE_OFF: "Once-off", MONTHLY: "Monthly retainer" };

/** The proposal document as the client sees it (also used for staff preview). */
export function ProposalDocument({ p, firm, number }: { p: ProposalWithLines; firm: Firm; number: string }) {
  const t = totalsOf(p);
  const groups = (["ONCE_OFF", "MONTHLY"] as const).map((b) => ({ billing: b, lines: p.lineItems.filter((l) => l.billingType === b) })).filter((g) => g.lines.length);
  const vat = p.vatRatePercent > 0;

  return (
    <article className="space-y-6 text-sm">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand">Proposal {number}</div>
          <h1 className="mt-1 text-2xl font-semibold">{p.title}</h1>
          <div className="mt-1 text-muted">Prepared for {p.deal.name} · valid until {formatDate(p.validUntil, { day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
        <div className="text-right text-xs text-muted">
          <div className="font-semibold text-foreground">{firm.legalName}</div>
          {firm.registrationNumber && <div>Reg. {firm.registrationNumber}</div>}
          {firm.vatNumber && <div>VAT {firm.vatNumber}</div>}
          {firm.email && <div>{firm.email}</div>}
          {firm.phone && <div>{firm.phone}</div>}
        </div>
      </header>

      {p.introduction && <div className="whitespace-pre-wrap leading-relaxed">{p.introduction}</div>}

      {groups.map((g) => (
        <section key={g.billing}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{SECTION[g.billing]}</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-background text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">Service</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Price (excl. VAT)</th>
                  {vat && <th className="px-3 py-2 text-right font-medium">VAT</th>}
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {g.lines.map((l) => {
                  const ex = l.quantity * l.unitPriceCents;
                  const v = lineVat(l, p.vatRatePercent);
                  return (
                    <tr key={l.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{l.name}</div>
                        {l.description && <div className="mt-0.5 whitespace-pre-wrap text-xs text-muted">{l.description}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-right">{l.quantity}</td>
                      <td className="px-3 py-2.5 text-right">{formatRand(l.unitPriceCents)}</td>
                      {vat && <td className="px-3 py-2.5 text-right text-muted">{formatRand(v)}</td>}
                      <td className="px-3 py-2.5 text-right font-medium">{formatRand(ex + v)}{g.billing === "MONTHLY" && <span className="text-xs font-normal text-muted"> /mo</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="ml-auto max-w-sm space-y-1.5 rounded-lg bg-background p-4">
        {t.onceOff > 0 && <Row label={`Once-off${vat ? " (incl. VAT)" : ""}`} value={formatRand(t.onceOff)} />}
        {t.monthly > 0 && <Row label={`Monthly${vat ? " (incl. VAT)" : ""}`} value={`${formatRand(t.monthly)} /mo`} />}
        {vat && <Row label={`Includes VAT at ${p.vatRatePercent}%`} value={formatRand(p.onceOffVat + p.monthlyVat)} muted />}
        <div className="border-t border-border pt-2">
          <Row label="Due on acceptance" value={formatRand(t.dueNow)} strong />
          {t.monthly > 0 && (
            <p className="mt-1 text-xs text-muted">
              Includes the first month. After that, {formatRand(t.monthly)} is charged monthly from {formatDate(firstRenewal(p.startDate), { day: "numeric", month: "long", year: "numeric" })} until cancelled.
            </p>
          )}
        </div>
      </section>

      {p.terms && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Terms</h2>
          <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted">{p.terms}</div>
        </section>
      )}
    </article>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-semibold" : ""} ${muted ? "text-xs text-muted" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
