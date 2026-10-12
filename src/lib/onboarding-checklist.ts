import type { EntityType } from "@prisma/client";

export type ChecklistItem = { kind: "INFO" | "SETUP"; label: string; description?: string; required?: boolean; allowsText?: boolean };

const has = (services: string[], ...words: string[]) => services.some((s) => words.some((w) => s.toLowerCase().includes(w)));

/**
 * The onboarding checklist for a new client: what to ask them for, and the
 * internal setup steps. Driven by entity type and the services they bought.
 * Never ask clients to type passwords here: use eFiling/practitioner access instead.
 */
export function buildChecklist(entityType: EntityType, services: string[]): ChecklistItem[] {
  const company = entityType === "PRIVATE_COMPANY" || entityType === "NPO";
  const trust = entityType === "TRUST";
  const books = has(services, "bookkeeping", "financial statements", "accounting");
  const vat = has(services, "vat");
  const payroll = has(services, "payroll", "emp201");
  const registration = has(services, "registration");

  const info: ChecklistItem[] = [
    { kind: "INFO", label: company ? "Certified ID copies of all directors" : trust ? "Certified ID copies of all trustees" : "Certified copy of your ID", description: "Certified within the last 3 months." },
    { kind: "INFO", label: "Proof of address", description: "Utility bill or bank statement, not older than 3 months." },
  ];
  if (company && !registration) info.push({ kind: "INFO", label: "CIPC registration documents", description: "Registration certificate (CoR 14.3) and MOI." });
  if (trust) info.push({ kind: "INFO", label: "Trust deed and Letter of Authority" });
  info.push(
    { kind: "INFO", label: "SARS tax reference numbers", description: "Income tax number, plus PAYE and VAT numbers if registered.", allowsText: true },
    { kind: "INFO", label: "Bank confirmation letter", description: "Stamped letter from your bank confirming the business account." },
  );
  if (books) {
    info.push(
      { kind: "INFO", label: "Bank statements for the last 3 months" },
      { kind: "INFO", label: "Latest financial statements and trial balance", description: "From your previous accountant, if you had one.", required: false },
      { kind: "INFO", label: "Previous accountant's contact details", description: "So we can arrange a professional handover.", required: false, allowsText: true },
    );
  }
  if (vat) info.push({ kind: "INFO", label: "VAT registration certificate (VAT103)", required: false });
  if (payroll) {
    info.push(
      { kind: "INFO", label: "Employee list", description: "Names, ID numbers, start dates and monthly salaries.", allowsText: true },
      { kind: "INFO", label: "Latest payslips and EMP501 reconciliation", required: false },
    );
  }

  const setup: ChecklistItem[] = [
    { kind: "SETUP", label: "Signed engagement letter filed" },
    { kind: "SETUP", label: "Client details and contacts checked in Outset PM" },
    { kind: "SETUP", label: "Linked as tax practitioner on SARS eFiling" },
  ];
  if (books) setup.push({ kind: "SETUP", label: "QuickBooks company set up or access received" }, { kind: "SETUP", label: "Bank feeds connected" });
  if (books || vat || payroll) setup.push({ kind: "SETUP", label: "Recurring deadlines set up (VAT, EMP201, provisional tax)" });
  if (payroll) setup.push({ kind: "SETUP", label: "Payroll system set up with employees" });
  setup.push({ kind: "SETUP", label: "Team assigned and capacity checked" });

  return [...info, ...setup];
}
