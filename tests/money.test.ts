import { describe, expect, it } from "vitest";
import { computeTotals, dueNow, formatRand, monthlyTotal, parseRand } from "@/lib/money";

describe("proposal totals", () => {
  const lines = [
    { billingType: "ONCE_OFF" as const, quantity: 1, unitPriceCents: 350_000, taxable: true },
    { billingType: "MONTHLY" as const, quantity: 1, unitPriceCents: 250_000, taxable: true },
    { billingType: "MONTHLY" as const, quantity: 2, unitPriceCents: 33_333, taxable: true },
    { billingType: "ONCE_OFF" as const, quantity: 1, unitPriceCents: 50_000, taxable: false }, // e.g. CIPC fee passed through
  ];
  const t = computeTotals(lines, 15);

  it("splits once-off and monthly, with VAT per line", () => {
    expect(t).toEqual({ onceOffExVat: 400_000, onceOffVat: 52_500, monthlyExVat: 316_666, monthlyVat: 47_500 });
  });
  it("charges once-off plus the first month up front", () => {
    expect(monthlyTotal(t)).toBe(364_166);
    expect(dueNow(t)).toBe(816_666);
  });
  it("handles a non-VAT-registered firm (0%)", () => {
    expect(computeTotals(lines, 0).onceOffVat).toBe(0);
  });
});

describe("rand formatting", () => {
  it("formats and parses", () => {
    expect(formatRand(816_666)).toBe("R 8 166.66");
    expect(formatRand(5)).toBe("R 0.05");
    expect(parseRand("R 2 500.50")).toBe(250_050);
    expect(parseRand("2500")).toBe(250_000);
    expect(parseRand("12.345")).toBeNull();
  });
});
