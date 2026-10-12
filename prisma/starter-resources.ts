// Starter Resource Hub content. Generic South African practice procedures:
// review and adapt them to how Outset actually works before relying on them.

const NOTE = "> **Starter content.** Review and adapt this to how Outset works, then publish your own version.";

export const STARTER_RESOURCES = [
  {
    key: "vat",
    title: "Submitting a VAT201 return",
    summary: "Prepare, review and submit a client's VAT201 on eFiling.",
    category: "Tax",
    type: "SOP" as const,
    tags: ["vat", "vat201", "efiling", "sars"],
    body: `${NOTE}

## When
Every VAT period (usually every two months). The return and payment are due by the **25th** of the month after the period ends (the last business day if submitted and paid on eFiling).

## Before you start
- The period's bookkeeping is captured and the bank is reconciled
- You have the client's eFiling profile linked to our tax practitioner profile

## Steps
1. Run the VAT report for the period in QuickBooks.
2. Reconcile output VAT to sales and input VAT to purchases. Investigate anything unusual (large once-off purchases, imported services, zero-rated sales).
3. Check that every input-VAT claim over R5 000 has a valid tax invoice on file.
4. Complete the VAT201 on eFiling and save it as a draft.
5. Move the task to **In review** and ask the reviewer to check the draft.
6. After review, submit, then download the submitted return and the payment reference.
7. Email the client the amount payable, the payment reference and the due date.
8. Attach the submitted return to the task and mark it done.

## Checks
- [ ] VAT reconciles to the general ledger
- [ ] Reviewed by a second person
- [ ] Client told the amount and due date
`,
  },
  {
    key: "monthend",
    title: "Month-end bookkeeping close",
    summary: "Capture, reconcile, review and send management accounts.",
    category: "Bookkeeping",
    type: "SOP" as const,
    tags: ["bookkeeping", "month-end", "quickbooks", "reconciliation"],
    body: `${NOTE}

## Steps
1. **Request documents** in the first week of the month: bank statements, supplier invoices, sales invoices.
2. **Capture** all bank transactions in QuickBooks and match them to source documents.
3. **Reconcile** every bank account and credit card. The difference must be R0.00.
4. **Review** debtors and creditors ageing, and query anything older than 60 days with the client.
5. **Post** month-end journals (depreciation, prepayments, accruals) where applicable.
6. **Review**: a second person checks the reconciliations and the profit and loss for anything unusual.
7. **Send** management accounts to the client with a short summary of the month.

## Common issues
| Issue | What to do |
|---|---|
| Missing invoice | Ask the client; capture as *Query* until it arrives |
| Personal expense through the business account | Allocate to the owner's loan account, never to an expense |
`,
  },
  {
    key: "emp201",
    title: "Monthly payroll and EMP201",
    summary: "Process payroll, send payslips and submit the EMP201 by the 7th.",
    category: "Payroll",
    type: "SOP" as const,
    tags: ["payroll", "emp201", "paye", "uif", "sdl"],
    body: `${NOTE}

## Deadlines
The EMP201 (PAYE, UIF and SDL) is due by the **7th** of the following month (the last business day before it if the 7th falls on a weekend or public holiday).

## Steps
1. Collect payroll changes from the client by the 20th: new starters, leavers, overtime, leave, bonuses.
2. Process the payroll and check gross-to-net against last month. Explain every variance over 5%.
3. Send payslips to employees and the payroll summary to the client for approval.
4. Submit the EMP201 on eFiling and give the client the payment reference.
5. Declare UIF on uFiling.

> Twice a year (EMP501 reconciliations), use the separate reconciliation checklist.
`,
  },
  {
    key: "popia",
    title: "POPIA and client information policy",
    summary: "How we collect, store and share client personal information.",
    category: "Admin & policies",
    type: "POLICY" as const,
    tags: ["popia", "privacy", "security", "policy"],
    body: `${NOTE}

## Principles
- Collect only what we need to do the work.
- Client documents go into **Outset PM** (onboarding uploads or task attachments). Never keep them on personal devices or in personal email.
- **Never** ask clients to send passwords. Use eFiling tax practitioner access, or ask them to invite us to their software.
- Share client information only with the client, SARS/CIPC as needed for the work, or with the client's written consent.

## If something goes wrong
If you think client information was sent to the wrong person or accessed without permission, tell a Director **immediately**. We may need to notify the Information Regulator and the client.

## Retention
We keep client records for at least 5 years after the end of the relevant tax year, as SARS requires, then delete them.
`,
  },
  {
    key: "newclient",
    title: "Onboarding a new client in Outset PM",
    summary: "What happens after a client signs and pays, and what you do at each stage.",
    category: "Client service",
    type: "GUIDE" as const,
    tags: ["onboarding", "outset pm", "process"],
    body: `${NOTE}

## What happens automatically
When a proposal is signed and paid, Outset PM creates the client, their projects, an onboarding checklist and sends the welcome pack with a secure upload link.

## Your job at each stage
1. **Information requested.** Watch for uploads (you're notified). Reminders go out automatically. Call the client if the "Call client" task appears.
2. **Information received.** Open the onboarding page and **Accept** each item, or **Send back** with a clear reason.
3. **Setup.** Work through the setup checklist: SARS eFiling practitioner link, QuickBooks, bank feeds, deadlines.
4. **Review.** The reviewer checks everything and approves. The client becomes Active.

## Tips
- Be specific when sending items back, e.g. "The ID copy must be certified within the last 3 months".
- Keep the client's contacts up to date: reminders go to the first contact with an email address.
`,
  },
];

export const STARTER_TEMPLATE_LINKS: { template: string; task: string; resource: string }[] = [
  { template: "VAT201 Return", task: "Submit on eFiling and send payment details to client", resource: "vat" },
  { template: "VAT201 Return", task: "Prepare VAT201", resource: "vat" },
  { template: "Monthly Bookkeeping", task: "Review and close month", resource: "monthend" },
  { template: "Monthly Bookkeeping", task: "Bank reconciliation", resource: "monthend" },
  { template: "EMP201 Payroll Submission", task: "Prepare and submit EMP201", resource: "emp201" },
];

export const STARTER_PROGRAMME = {
  name: "New team member: first 30 days",
  description: "Gets a new accountant or bookkeeper productive and confident in their first month.",
  steps: [
    { title: "Read the POPIA and client information policy", resource: "popia", day: 0, minutes: 20 },
    { title: "Set up Google Workspace, Outset PM and QuickBooks access", day: 0, minutes: 60 },
    { title: "Read: Onboarding a new client in Outset PM", resource: "newclient", day: 1, minutes: 20 },
    { title: "Read: Month-end bookkeeping close", resource: "monthend", day: 2, minutes: 30 },
    { title: "Shadow a discovery call", day: 7, minutes: 45 },
    { title: "Read: Submitting a VAT201 return", resource: "vat", day: 10, minutes: 30 },
    { title: "Complete a month-end close with your mentor", day: 21, minutes: 240 },
    { title: "30-day check-in with a Director", day: 30, minutes: 45 },
  ],
};
