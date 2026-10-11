import type { Priority } from "@prisma/client";

type T = { title: string; due?: number; est?: number; priority?: Priority; subtasks?: string[] };

// Starter job templates for a South African practice. Edit freely in the app later.
export const TEMPLATES: { name: string; description: string; tasks: T[] }[] = [
  {
    name: "Monthly Bookkeeping",
    description: "Month-end bookkeeping cycle through to management accounts.",
    tasks: [
      { title: "Request source documents", due: 0, est: 15, subtasks: ["Bank statements", "Supplier invoices", "Sales invoices & receipts"] },
      { title: "Capture transactions", due: 5, est: 180 },
      { title: "Bank reconciliation", due: 7, est: 60 },
      { title: "Review and close month", due: 9, est: 45, priority: "HIGH" },
      { title: "Send management accounts to client", due: 10, est: 20 },
    ],
  },
  {
    name: "VAT201 Return",
    description: "Bi-monthly VAT201 preparation and eFiling submission.",
    tasks: [
      { title: "Obtain VAT reports from accounting system", due: 0, est: 15 },
      { title: "Reconcile input and output VAT", due: 3, est: 60 },
      { title: "Prepare VAT201", due: 5, est: 30 },
      { title: "Review VAT201", due: 6, est: 20, priority: "HIGH" },
      { title: "Submit on eFiling and send payment details to client", due: 7, est: 20, priority: "HIGH" },
    ],
  },
  {
    name: "EMP201 Payroll Submission",
    description: "Monthly payroll and EMP201 (PAYE, UIF, SDL).",
    tasks: [
      { title: "Collect payroll changes from client", due: 0, est: 15 },
      { title: "Process payroll", due: 2, est: 60 },
      { title: "Send payslips", due: 3, est: 15 },
      { title: "Prepare and submit EMP201", due: 5, est: 30, priority: "HIGH" },
    ],
  },
  {
    name: "Annual Financial Statements",
    description: "Year-end AFS and ITR14 income tax return.",
    tasks: [
      { title: "Request year-end information", due: 0, est: 30, subtasks: ["Trial balance", "Fixed asset register", "Loan statements", "Stock count"] },
      { title: "Year-end adjustments", due: 14, est: 240 },
      { title: "Draft financial statements", due: 21, est: 240 },
      { title: "Manager review", due: 25, est: 60, priority: "HIGH" },
      { title: "Client sign-off", due: 30, est: 30 },
      { title: "Prepare and submit ITR14", due: 45, est: 120, priority: "HIGH" },
    ],
  },
  {
    name: "CIPC Annual Return",
    description: "Annual return filing with CIPC.",
    tasks: [
      { title: "Confirm anniversary date and turnover", due: 0, est: 10 },
      { title: "File annual return on CIPC", due: 3, est: 20 },
      { title: "Pay CIPC fee", due: 3, est: 10 },
      { title: "Send confirmation to client", due: 4, est: 10 },
    ],
  },
  {
    name: "Company Registration (CIPC)",
    description: "New company registration through to SARS tax registration.",
    tasks: [
      { title: "Name reservation", due: 0, est: 20 },
      { title: "Register company on CIPC", due: 3, est: 45, subtasks: ["Director IDs", "Proof of address", "MOI"] },
      { title: "Issue share certificates", due: 7, est: 30 },
      { title: "Bank confirmation letter", due: 7, est: 15 },
      { title: "SARS income tax registration", due: 10, est: 30 },
    ],
  },
];
