import { describe, expect, it } from "vitest";
import { buildChecklist } from "@/lib/onboarding-checklist";
import { resolveType, validateFile } from "@/lib/storage";

describe("onboarding checklist", () => {
  it("asks a company with bookkeeping + VAT for the right things", () => {
    const items = buildChecklist("PRIVATE_COMPANY", ["Monthly Bookkeeping", "VAT Returns"]);
    const info = items.filter((i) => i.kind === "INFO").map((i) => i.label);
    expect(info).toContain("Certified ID copies of all directors");
    expect(info).toContain("CIPC registration documents");
    expect(info).toContain("VAT registration certificate (VAT103)");
    expect(info).toContain("Bank statements for the last 3 months");
    expect(info).not.toContain("Employee list");
    expect(items.filter((i) => i.kind === "SETUP").map((i) => i.label)).toContain("Bank feeds connected");
  });

  it("doesn't ask for CIPC documents when we're registering the company", () => {
    const info = buildChecklist("PRIVATE_COMPANY", ["Company Registration (CIPC)"]).map((i) => i.label);
    expect(info).not.toContain("CIPC registration documents");
  });

  it("adds payroll and trust items", () => {
    const info = buildChecklist("TRUST", ["Payroll (up to 10 employees)"]).map((i) => i.label);
    expect(info).toContain("Trust deed and Letter of Authority");
    expect(info).toContain("Employee list");
  });

  it("never asks for passwords", () => {
    const all = buildChecklist("PRIVATE_COMPANY", ["Monthly Bookkeeping", "VAT Returns", "Payroll"]);
    expect(all.some((i) => /password/i.test(`${i.label} ${i.description ?? ""}`))).toBe(false);
  });
});

describe("upload validation", () => {
  it("accepts documents and rejects executables and huge files", () => {
    expect(validateFile({ name: "id.pdf", type: "application/pdf", size: 1000 })).toBeNull();
    expect(resolveType("statement.xlsx", "application/octet-stream")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(validateFile({ name: "virus.exe", type: "application/x-msdownload", size: 1000 })).toMatch(/please upload/);
    expect(validateFile({ name: "big.pdf", type: "application/pdf", size: 16 * 1024 * 1024 })).toMatch(/15 MB/);
    expect(validateFile({ name: "empty.pdf", type: "application/pdf", size: 0 })).toMatch(/empty/);
  });
});
