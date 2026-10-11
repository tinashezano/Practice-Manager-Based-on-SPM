# Outset PM — Build Plan

An operations platform for accounting firms, modelled on Sole Practice Manager,
built around one end-to-end workflow:

```
LEAD → DISCOVERY → PROPOSAL → SIGNED + PAID → ONBOARDING → TASK MANAGEMENT
```

Everything a lead or client does produces records and tasks automatically, so the
team works from task lists and dashboards and doesn't have to chase status by hand.

---

## 1. Guiding principles

1. **The client is the spine.** Every task, document, proposal, payment and
   onboarding record links to a Client (or to a Lead before they become one).
   Hierarchy: **Client → Project/Engagement → Task → Subtask**.
2. **Events drive automation.** Each step emits an event (`lead.created`,
   `booking.confirmed`, `envelope.completed`, `payment.succeeded` and so on).
   Automations listen for events. They are not hard-coded into page handlers,
   which makes them testable, retryable and auditable.
3. **External systems are the source of truth for their own step.** DocuSign
   owns signature state and Paystack owns payment state. We store a mirror and
   update it **only from verified webhooks**, never from a browser redirect.
4. **Idempotent everywhere.** Webhooks get retried and can arrive out of order.
   "Signed + Paid → create client" must run exactly once, whichever event
   arrives last.
5. **Ship in vertical slices.** Each phase ends with something usable in the
   real firm.

---

## 2. Recommended tech stack

| Layer | Choice | Why |
|---|---|---|
| App framework | **Next.js (App Router) + TypeScript** | One codebase for UI and API routes or webhooks, server components for dashboards |
| UI | **Tailwind CSS + shadcn/ui**, lucide icons | Matches Sole's clean card-and-sidebar look; fast to build |
| Board / drag-drop | `@dnd-kit` | Kanban for deals, onboarding and tasks |
| Calendar / timeline | FullCalendar (calendar), custom or `frappe-gantt` (timeline) | Calendar and Timeline task views |
| Charts | Recharts | Dashboards (revenue trend, WIP ageing, utilisation) |
| Database | **PostgreSQL on Railway** | Relational data; one firm, so single-tenant |
| ORM | **Prisma** (or Drizzle) | Typed schema and migrations |
| Auth | **Auth.js with Google sign-in**, limited to the firm's Workspace domain | Staff log in with their work Google accounts; only staff a Director has added can get in |
| Background jobs | **pg-boss** (job queue stored in Postgres) in a Railway worker service | Event-driven automations, retries, delays ("remind in 3 days"), no extra service to pay for |
| Email | **Gmail API** (sends from your Workspace mailbox) + React Email templates | Booking links, welcome pack, info requests; sent mail shows in Gmail |
| File storage | S3-compatible bucket (Cloudflare R2 or Railway volume) | Client documents, signed PDFs, SOP attachments |
| E-signature | **DocuSign eSignature REST API** (JWT grant) | Proposals and engagement letters |
| Payments | **Paystack** (Transactions + Payment Pages, Subscriptions) | Upfront fees and recurring retainers |
| Booking | **Our own booking page on top of Google Calendar**: free/busy lookup and event creation with a Meet link | "Send Discovery Call booking link"; the booking lands in your calendar and fires our automation directly |
| Rich text (SOPs) | TipTap | Resource Hub editor |
| Hosting | **Railway**: web service, worker service and Postgres | Your existing host |
| Accounting | **QuickBooks Online API** (Phase 8) | Sync clients as customers, push invoices and payments |

> Paystack and the CIPC task in your screenshot suggest a South African firm.
> The plan assumes **ZAR**, VAT at 15%, SAST and SA-specific services (CIPC, SARS
> eFiling, EMP201, VAT201, provisional tax). All of these will be configurable.

---

## 3. App structure (navigation)

This mirrors Sole's sidebar, adapted to your workflow:

```
My focus
  ├─ My Dashboard           (my tasks today, overdue, my reviews, my time)
  └─ Notifications
Firm Overview
  ├─ Practice Dashboard     (revenue, WIP, utilisation, jobs overdue, capacity)
  └─ Helicopter View        (daily stand-up matrix, risks, management focus)
Leads & Deals
  ├─ Pipeline (Kanban)      New Lead → Discovery Booked → Discovery Completed →
  │                         Proposal Required → Proposal Sent → Won / Lost
  └─ Deals (table + reports)
Proposals
  ├─ Overview
  ├─ Proposals              Draft · Sent · Viewed · Signed · Paid · Expired
  ├─ Services               (service catalogue with pricing)
  └─ Service Packages       (bundles, e.g. "Startup Pack")
Clients
  ├─ Clients                (profile, contacts, entities, projects, docs, billing)
  └─ Onboarding (Kanban)    Info Requested → Info Received → Setup → Review → Complete
Work
  ├─ Tasks                  List · Board · Calendar · Timeline (grouped by client)
  ├─ Projects / Jobs
  ├─ Workload & Capacity
  └─ Time Tracker
Scheduling
  ├─ Calendar
  └─ Booking Links
Resource Hub
  ├─ SOPs & Procedures
  ├─ Templates
  └─ Staff Onboarding       (new-employee programmes with checklists)
Settings / Team
  ├─ Team & Roles & Permissions
  ├─ Service Lines
  ├─ Automations            (view, enable and edit the workflow rules)
  └─ Integrations           (DocuSign, Paystack, Google/Microsoft, email)
```

---

## 4. The workflow in detail (automation map)

### 4.1 Lead & Qualification

| Trigger | Automation |
|---|---|
| New lead (manual entry, website form, booking page, import) | Create **Lead/Deal** + **Contact** in CRM at stage *New Lead*. Assign an owner using round-robin or a default rule. |
| `lead.created` | Email the lead the **Discovery Call booking link** (template). Log the activity. Schedule a follow-up task if the lead hasn't booked within *N* days. |
| `booking.confirmed` (booking page or webhook) | Move deal to *Discovery Booked*. Create **"Discovery Call – {Lead}"** task due at the meeting time, assigned to the call owner. Add a calendar event with the video link. |
| Call marked completed (task done or meeting outcome form) | Move deal to *Discovery Completed → Proposal Required*. Create **"Prepare Proposal – {Lead}"** task (due in 2 business days). Save call notes and qualification answers (entity type, services needed, turnover, deadlines). |
| Deal marked Lost | Record the loss reason and close open lead tasks. Optionally add to a nurture list. |

Pipeline cards show value, probability, owner, next action and age, as in Sole's Deals board.

### 4.2 Proposal & Engagement (DocuSign + Paystack)

**Building the proposal (in-app):**
1. Pick services and packages from the catalogue. Pricing is once-off, monthly or annual, with VAT calculated.
2. The app produces the proposal and engagement letter from a **DocuSign template**,
   with fields pre-filled through the API (client name, fees, scope, start date).
3. **Embedded sending:** staff review and adjust the envelope inside the app in a
   DocuSign Sender View, without leaving it.

**Client signing:**
- The client gets an email, or opens a branded page in our app with **embedded signing**
  (DocuSign Recipient View, or Focused View for an in-page experience).
- After signing, DocuSign redirects to our **"Complete your payment"** page.

**Payment (Paystack):**
- Once-off or upfront fee: initialise a Paystack transaction and redirect to checkout.
- Monthly retainer: create a Paystack **Plan + Subscription** (card authorisation reused).
- The payment reference stores `proposalId` in metadata so the webhook can match it.
- A proposal can mix both. Once-off items are charged at checkout. Retainer items start a subscription whose
  first charge is taken at the same checkout.
- **Onboarding waits for payment.** "Paid" means the once-off amount and (for retainers)
  the first subscription charge succeeded.

**Webhooks (source of truth):**
- DocuSign Connect `envelope-completed` → proposal `signedAt`, store the signed PDF.
- Paystack `charge.success`, with the signature checked against the secret key and
  the transaction re-verified through the API → proposal `paidAt`.

**When BOTH signed and paid (the "Won" automation, runs once):**
1. **Create Client** from the lead and contact, carrying over entity details, services and fees.
2. Create **Projects/Engagements** for each service bought (e.g. Bookkeeping, Annual Financials, Tax).
3. Create an **Onboarding** record at *Information Requested* using the onboarding
   template for those services. It generates the checklist and info-request tasks.
4. Send the **Welcome Pack**: email with a PDF or link, the info-request list and an upload portal link.
5. **Notify** the responsible team member (in-app, email, optionally Slack/Teams), and
   assign the onboarding owner.
6. Move the deal to **Won**.

Edge cases: signed but unpaid after X days → reminder email and staff task; payment
failed → notify the owner; envelope declined or voided → back to *Proposal Required*;
proposal expiry dates.

### 4.3 Client Onboarding

Kanban and per-client checklist:
```
Information Requested → Information Received → Setup → Review → Complete
```
- **Information Requested:** secure upload link or client-portal page with the
  required documents (IDs, CIPC docs, SARS PINs, bank statements, prior AFS, eFiling
  access). Automatic reminders every N days.
- **Information Received:** moves forward automatically when every required item is
  uploaded, or manually. Creates a "Review documents" task.
- **Setup:** template tasks such as Xero/QuickBooks file, SARS eFiling link,
  recurring deadlines (VAT, EMP201, provisional tax) and recurring jobs.
- **Review:** manager sign-off task.
- **Complete:** client becomes *Active*, recurring work schedules start, and a
  welcome-call or check-in task is created.

### 4.4 Task Management

**Hierarchy:** Client → Project (engagement or job) → Task → Subtask (one nested
level to start; the data model allows more).

**Task fields:** title, description (rich text), client, project, assignee, reviewer,
status, priority, start and due date, estimated hours, time logged, tags, recurrence,
checklist, attachments, comments with @mentions, dependencies (Phase 2), watchers.

**Views** (same data, saved filters per user):
- **List:** grouped by Client, then Project, collapsible, with inline add and edit
  (like Sole's Work Management screen).
- **Board:** Kanban by status (To Do, In Progress, Waiting on Client, In Review, Done).
  Can also group by assignee or priority.
- **Calendar:** month and week by due date, drag to reschedule.
- **Timeline:** Gantt by start to due date, grouped by client or assignee.

**Other capabilities:** task templates and job templates (e.g. "Monthly Bookkeeping"
creates 8 subtasks), recurring tasks, side detail panel, My Tasks / My Reviews,
bulk edit, and a timer on any task that feeds the Time Tracker.

### 4.5 Resource Hub

- **SOP library:** categories (Tax, Bookkeeping, Payroll, Admin, Onboarding), rich-text
  articles with attachments and video embeds, versioning, owner, review-due date, search.
- **Link SOPs to work:** task templates reference the SOP, so a "VAT201 submission"
  task shows the SOP in its side panel.
- **Templates:** email templates, letters, checklists.
- **Staff Onboarding:** programmes such as "New Bookkeeper – first 30 days" with
  ordered modules (read SOP, watch video, complete quiz or acknowledgement). Each
  employee's progress is tracked and their tasks are assigned automatically on start date.

### 4.6 Workload Management

- Each staff member has **weekly capacity** (hours, leave, public holidays) and a
  billable target.
- Each task has **estimated hours**, spread over its start-to-due window.
- **Capacity planner:** a heatmap with people as rows and weeks as columns, coloured by
  % allocated (under, healthy, over). Drag tasks to rebalance.
- **Time tracker:** timer and manual entries against tasks. This feeds utilisation,
  realisation and WIP.
- Alerts appear in the Helicopter View ("Team overload", "Capacity risk").

### 4.7 Dashboards

- **Practice Dashboard:** revenue MTD, net margin, utilisation, realisation, WIP value,
  jobs overdue, available capacity, revenue trend, WIP ageing, recurring vs
  once-off split, profitability by service line.
- **Helicopter View:** operational snapshot (tasks at risk, overdue, blocked, waiting on
  client, clients with delays, team overload), insights, and a ranked "today's
  management focus" list.
- **My Dashboard:** my day, my overdue, my reviews, my time this week.

---

## 5. Data model (core entities)

```
Organization ─┬─ User (role, capacity_hours_per_week, cost_rate, bill_rate)
              ├─ Role / Permission
              ├─ ServiceLine
              ├─ Service (price, billing_type: once_off|monthly|annual, est_hours, service_line)
              ├─ ServicePackage ── ServicePackageItem → Service
              │
              ├─ Contact (person: name, email, phone)
              ├─ Lead/Deal (stage, value, probability, owner, source, lost_reason, contact)
              │     ├─ Activity (note, email, call, stage_change)
              │     └─ Booking (start, end, meeting_url, status)
              │
              ├─ Proposal (deal, status, total, vat, valid_until, signed_at, paid_at)
              │     ├─ ProposalLineItem → Service
              │     ├─ Envelope (docusign_envelope_id, status, signed_pdf_url)
              │     └─ Payment (paystack_reference, amount, status, subscription_code)
              │
              ├─ Client (name, entity_type, reg_no, tax_no, vat_no, status, owner, from_deal)
              │     ├─ ClientContact → Contact
              │     ├─ Onboarding (stage, owner, template)
              │     │     └─ InfoRequestItem (label, required, status, file)
              │     ├─ Project/Engagement (service, status, budget_hours, fee)
              │     │     └─ Task (parent_task_id → subtasks, status, priority, assignee,
              │     │              reviewer, start, due, estimate_hours, recurrence, position)
              │     │           ├─ Comment, Attachment, ChecklistItem
              │     │           └─ TimeEntry (user, minutes, billable, rate)
              │     └─ Document
              │
              ├─ TaskTemplate / ProjectTemplate / OnboardingTemplate
              ├─ Resource (SOP: title, body, category, version, owner, review_due)
              ├─ StaffOnboardingProgram ── Module ── EmployeeProgress
              ├─ Notification
              ├─ AutomationRule (trigger event, conditions, actions, enabled)
              └─ EventLog / WebhookLog (raw payloads, processed_at — for idempotency & audit)
```

Tasks can also link to a **Lead** (before a client exists), so discovery-call and
proposal tasks appear in the task views. They carry over to the client on conversion.

---

## 6. Integrations: implementation notes

**DocuSign**
- Developer (demo) account first, then go-live review. API access needs a plan that includes the eSignature API.
- Auth: JWT Grant with an integration key and RSA key, impersonating a firm user (one-time consent).
- Templates: one proposal or engagement-letter template with tabs (fields) matching our proposal data.
- **No account yet.** Phase 3 builds the proposal flow behind an e-signature adapter. Until DocuSign is connected, a Director can mark a proposal "Signed" by uploading the signed PDF, and every later automation works the same way. Connecting DocuSign later is a settings change, not a rebuild. A free DocuSign developer account is enough for testing.
- Embedded sending: `EnvelopeViews: createSender`. Embedded signing: `createRecipient` with a
  `clientUserId` (or Focused View via DocuSign JS for an in-page frame).
- DocuSign Connect webhook (HMAC verified) on `envelope-sent`, `-delivered`, `-completed`, `-declined`, `-voided`.

**Paystack**
- Test keys first. `POST /transaction/initialize` returns `authorization_url`, with `metadata.proposalId`.
- Subscriptions: `POST /plan` and `POST /subscription` (or initialise with `plan`) for monthly retainers.
- Webhook: verify `x-paystack-signature` (HMAC SHA512 of the body with the secret key), then
  `GET /transaction/verify/:reference` before trusting it. Reply 200 quickly and process in a background job.

**Booking (Google Calendar)**
- Each staff member connects their Google Calendar once (OAuth, calendar scope).
- The public booking page `/book/<link>` shows open slots from Google free/busy,
  within working hours and with buffers.
- Booking a slot creates the event in the staff member's calendar with a Google Meet
  link and invites the lead. In the same step it fires `booking.confirmed`, which moves the deal and
  creates the Discovery Call task. No third-party booking tool or webhook is needed.
- Reschedule and cancel links in the confirmation email update the event and the task.

**Email and calendar:** Google Workspace. Sign-in, Calendar (booking and task due dates) and Gmail API sending.

**QuickBooks Online (Phase 8)**
- OAuth 2.0 connection from Settings → Integrations.
- New client → QBO Customer. Paystack payment → QBO Invoice + Payment (or Sales Receipt).
- Monthly retainers → matching QBO invoices each cycle.

**Later:** SARS deadline calendar, WhatsApp notifications.

---

## 7. Security and compliance

- Single firm (single-tenant). Every query is checked against the user's role on the server, not just hidden in the UI.
- Roles: Owner, Manager, Staff, Read-only, and later Client (portal).
- **POPIA:** consent capture on lead forms, data minimisation, retention policy, audit log,
  and encrypted storage for ID or tax documents.
- Secrets live in environment variables or a vault, never in the repo. Webhook signatures are always verified.

---

## 8. Delivery phases

| Phase | Scope | Outcome |
|---|---|---|
| **0. Foundation** ✅ | Next.js + Postgres + Google Workspace login, roles, Team & Roles screen, app shell, event log, Railway config | Staff can log in and see the shell |
| **1. Clients and Task Management** (3–4 wks) | Clients, projects, tasks + subtasks, List/Board/Calendar/Timeline views, comments, attachments, task templates, My Tasks | The team can run daily work in the app (most value, earliest) |
| **2. Leads, Pipeline and Booking** (2–3 wks) | CRM, deal Kanban, lead capture form, booking links, automations: lead → booking email → discovery task → proposal task | Front of funnel automated |
| **3. Proposals, DocuSign and Paystack** (3–4 wks) | Service catalogue and packages, proposal builder, DocuSign embedded send and sign, Paystack checkout and subscriptions, webhooks, "Signed + Paid → Won" automation | Lead turns into a paying client with no manual steps |
| **4. Onboarding** (2 wks) | Onboarding Kanban, templates, secure per-request upload links (no client login), reminders, welcome pack, notifications | Onboarding runs to a checklist |
| **5. Resource Hub** (1–2 wks) | SOP library, search, versioning, linking SOPs to task templates, staff onboarding programmes | Knowledge and new-hire training in one place |
| **6. Workload and Time** (2–3 wks) | Capacity settings, time tracker, capacity heatmap, rebalancing | Visibility of who is overloaded |
| **7. Dashboards** (2 wks) | My Dashboard, Practice Dashboard, Helicopter View | Management control centre |
| **8. QuickBooks Online and later** | QBO sync (customers, invoices, payments), recurring compliance calendar (SARS), AI assistant ("Ask"), mobile polish | Books and practice manager stay in step |

Each phase includes tests (unit tests for automations, Playwright end-to-end tests
for key flows) and a deploy to a staging URL.

---

## 9. Decisions (confirmed)

| Topic | Decision |
|---|---|
| Hosting | **Railway** (web, worker, Postgres) |
| Booking | **Google Calendar**, through our own booking page that uses Calendar free/busy and Meet links |
| DocuSign | Account comes later. Build behind an adapter and use manual "upload signed PDF" until then |
| Payments | **Both** once-off and monthly retainers (Paystack). **Onboarding starts only after payment** |
| Client portal | **None.** Secure per-request upload links |
| Workspace | **Google Workspace** (sign-in, Calendar, Gmail) |
| Accounting | **QuickBooks Online** (Phase 8) |
| Team | 5 staff. Roles: **Director, Accountant, Bookkeeper** (matrix below) |
| Name | **Outset PM**. Logo and colours to follow. Brand colours are tokens in `src/app/globals.css` |

### Role permissions (proposed — confirm or adjust)

| Capability | Director | Accountant | Bookkeeper |
|---|:-:|:-:|:-:|
| Firm financials (revenue, margins, rates) | ✅ | — | — |
| Team & roles, settings, integrations, service pricing | ✅ | — | — |
| Leads, pipeline, bookings | ✅ | ✅ | — |
| Proposals | ✅ | ✅ | — |
| Create and edit clients, onboarding | ✅ | ✅ | view |
| Edit or reassign anyone's tasks | ✅ | ✅ | — |
| Work on own and assigned tasks | ✅ | ✅ | ✅ |
| Write and publish SOPs | ✅ | ✅ | read |
| Whole-team workload | ✅ | ✅ | own only |

### Still open
- Logo file and brand colours (the current indigo is a placeholder).
- The permission matrix above.
