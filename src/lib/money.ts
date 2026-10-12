import type { BillingType } from "@prisma/client";

export type PricedLine = { billingType: BillingType; quantity: number; unitPriceCents: number; taxable: boolean };

export type Totals = {
  onceOffExVat: number;
  onceOffVat: number;
  monthlyExVat: number;
  monthlyVat: number;
};

/** VAT is calculated per line and rounded to the cent, as on a tax invoice. */
export function lineVat(line: PricedLine, vatRatePercent: number) {
  return line.taxable ? Math.round((line.quantity * line.unitPriceCents * vatRatePercent) / 100) : 0;
}

export function computeTotals(lines: PricedLine[], vatRatePercent: number): Totals {
  const t: Totals = { onceOffExVat: 0, onceOffVat: 0, monthlyExVat: 0, monthlyVat: 0 };
  for (const l of lines) {
    const ex = l.quantity * l.unitPriceCents;
    const vat = lineVat(l, vatRatePercent);
    if (l.billingType === "MONTHLY") {
      t.monthlyExVat += ex;
      t.monthlyVat += vat;
    } else {
      t.onceOffExVat += ex;
      t.onceOffVat += vat;
    }
  }
  return t;
}

/** What the client pays at checkout: once-off fees plus the first month of any retainer. */
export function dueNow(t: Totals) {
  return t.onceOffExVat + t.onceOffVat + monthlyTotal(t);
}

export function monthlyTotal(t: Totals) {
  return t.monthlyExVat + t.monthlyVat;
}

/** Formats cents with two decimals: "R 1 234.50". Hand-rolled to match on server and browser. */
export function formatRand(cents: number) {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const rands = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}R ${rands}.${String(abs % 100).padStart(2, "0")}`;
}

/** "1 234.50" or "1234.5" → cents. Returns null if it isn't a valid amount. */
export function parseRand(input: string) {
  const clean = input.replace(/[\sR ,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
