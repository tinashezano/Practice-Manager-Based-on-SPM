# Outset PM

Practice management for Outset. It covers the whole client journey:
**Lead → Discovery → Proposal → Signed + Paid → Onboarding → Task Management**.
See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and build phases.

Stack: Next.js 15 (App Router, TypeScript), Tailwind CSS, Prisma + PostgreSQL,
Auth.js with Google Workspace sign-in. Hosted on Railway.

## Local development

```bash
cp .env.example .env          # fill in values (see comments in the file)
npm install
npx prisma migrate dev        # create tables
npm run db:seed               # creates the first Director from BOOTSTRAP_DIRECTOR_EMAIL
npm run dev                   # http://localhost:3000
```

Without Google OAuth credentials you can still sign in locally: set
`DEV_LOGIN_ENABLED=true` in `.env` and use the "Development login" box with a
seeded staff email. This login never works in production.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Google sign-in setup (one-off)

1. Google Cloud Console → create a project → **APIs & Services → OAuth consent screen**:
   choose **Internal** (only your Workspace users).
2. **Credentials → Create OAuth client ID → Web application**. Authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` and `http://localhost:3000/api/google/callback`
   - `https://<your-railway-domain>/api/auth/callback/google` and `https://<your-railway-domain>/api/google/callback`
3. **APIs & Services → Library**: enable **Google Calendar API** and **Gmail API**.
4. Put the client ID and secret in `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
5. Each staff member who hosts discovery calls or owns leads clicks **Connect Google**
   (Leads & Deals → Booking Links). That grants Calendar (availability, events with
   Meet links) and Gmail send (automated emails come from their own mailbox).

Only people added under **Settings → Team & Roles** with an `@ALLOWED_EMAIL_DOMAIN`
address can sign in.

## Deploying to Railway

1. New project → **Deploy from GitHub repo** → pick this repository.
2. Add a **PostgreSQL** service to the project.
3. On the app service, set variables:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `AUTH_SECRET` (run `npx auth secret`), `AUTH_URL` = `https://<your-domain>`, `AUTH_TRUST_HOST=true`
   - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAIL_DOMAIN`
   - `BOOTSTRAP_DIRECTOR_EMAIL`, `BOOTSTRAP_DIRECTOR_NAME`
4. Generate a domain under **Settings → Networking**.

`railway.json` builds with `npm run build`. On each deploy it runs database migrations
and the seed (safe to repeat) before starting, and uses `/api/health` as the healthcheck.

## Paystack

1. Paystack dashboard → **Settings → API Keys & Webhooks**: copy the **test** secret key
   into `PAYSTACK_SECRET_KEY` (starts with `sk_test_`).
2. Set the webhook URL to `https://<your-railway-domain>/api/paystack/webhook`.
3. Send yourself a proposal, accept it and pay with a
   [Paystack test card](https://paystack.com/docs/payments/test-payments/).
4. When ready, swap in the `sk_live_` key. **Settings → Proposals & billing** shows which mode is active.

With no key on a development machine, checkout is simulated so the whole flow can be
tested; in production without a key, online payment is off and staff record EFTs.

The first payment is the once-off fees plus the first month of any retainer (card only
when there's a retainer, so the card can be reused). Retainers then become a Paystack
subscription charged monthly. Payments are always re-verified with Paystack's API
before anything changes.

## Automations

Things that happen (new lead, booking, task completed, stage change) are recorded
as events. A small job queue in Postgres runs the automations, retrying failures.
The worker runs inside the web server (`src/instrumentation.ts`), so Railway needs
only one service. Switch rules on or off and see recent runs and the email outbox
under **Settings → Automations**.

Public pages (no login): `/book/<link>` (booking), `/book/manage/<token>`
(lead's reschedule/cancel) and `/enquiry` (website form; can be embedded with
`?embed=1`).

## Dashboard definitions

- **Revenue**: payments received (Paystack, including monthly retainer renewals, and recorded EFTs), excluding VAT, by payment date.
- **Work value**: billable time × the person's billing rate when the time was logged.
- **Margin**: (revenue − staff time cost) ÷ revenue.
- **Utilisation**: billable hours ÷ available hours (after public holidays and leave).
- **Realisation**: revenue ÷ work value.
- **WIP**: billable work value on tasks that aren't done, aged by when the time was logged.

## Roles

| Role | Access |
|---|---|
| Director | Everything, including financials, team, settings and integrations |
| Accountant | Leads, proposals, clients, onboarding, all tasks, SOP editing |
| Bookkeeper | Own/assigned tasks, client details, SOPs (read-only) |

Permissions are defined in `src/lib/permissions.ts`.
