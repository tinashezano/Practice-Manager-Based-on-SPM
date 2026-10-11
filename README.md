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

Checks: `npm run lint`, `npm run typecheck`, `npm run build`.

## Google sign-in setup (one-off)

1. Google Cloud Console → create a project → **APIs & Services → OAuth consent screen**:
   choose **Internal** (only your Workspace users).
2. **Credentials → Create OAuth client ID → Web application**. Authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-railway-domain>/api/auth/callback/google`
3. Put the client ID and secret in `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

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

## Roles

| Role | Access |
|---|---|
| Director | Everything, including financials, team, settings and integrations |
| Accountant | Leads, proposals, clients, onboarding, all tasks, SOP editing |
| Bookkeeper | Own/assigned tasks, client details, SOPs (read-only) |

Permissions are defined in `src/lib/permissions.ts`.
