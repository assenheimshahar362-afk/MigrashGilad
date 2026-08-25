# מגרש גילעד — Migrash Gilad

Production-oriented community football-pitch management PWA. The interface is
Hebrew, RTL-only, mobile-first, and built with Next.js 16, React 19, Supabase,
Tailwind CSS 4, and Serwist.

Visitors can view the schedule and submit a booking request without an account.
Allowlisted managers review requests, manage events and recurring allocations,
and maintain trustee details. Super admins also manage access, managers, and
the audit log.

## Quick start

Prerequisites: Node.js 20.9 or newer, Docker Desktop (or another
Docker-compatible runtime), and npm.

```bash
npm ci
cp .env.example .env.local

npm run db:start
npm run db:reset
npm run dev
```

Open <http://localhost:3000>. The local Supabase dashboard is available at
<http://localhost:54323>.

The public pages fail closed when Supabase is unavailable: the site still
renders, but database-backed content is empty and writes are unavailable.

## Environment

Copy `.env.example` to `.env.local`. Never commit `.env.local`.

Required for the application:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public, RLS-protected reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only writes, cron, and notifications |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for metadata and callback links |
| `CRON_SECRET` | Authenticates scheduled maintenance routes |
| `IP_HASH_SALT` | One-way hashing of rate-limit identifiers |

Production should also configure Cloudflare Turnstile
(`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`). Email and web
push are optional notification channels. Upstash Redis is optional because
rate limiting falls back to database-backed counters. Their variables are
documented in `.env.example`.

Google OAuth credentials are configured in Supabase Auth. Add
`https://<your-domain>/auth/callback` to the allowed redirect URLs.

## Database

There are exactly two SQL sources:

- `supabase/migrations/00000000000000_init.sql` — extensions, enums, tables,
  indexes, functions, grants, RLS policies, storage policies, and bootstrap
  super admin.
- `supabase/seed.sql` — deterministic public data for local development.

`supabase/config.toml` makes the CLI apply the migration first and the seed
second. The seed derives the rolling event schedule from recurring rules rather
than committing hundreds of stale generated rows.

Before the first remote deployment, edit the email under `PART 4 — BOOTSTRAP`
in the migration. The migration does not drop application tables or data and
also includes the historical requester-note backfill.

Preview every remote schema change before applying it:

```bash
npm run db:push -- --dry-run
npm run db:push
```

Do not seed production. `supabase db push --include-seed` is appropriate only
for disposable development or staging databases.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create the production build and service worker |
| `npm run start` | Serve the production build |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run lint` | Run Next.js, TypeScript, RTL, and secret-import lint rules |
| `npm test` | Run unit tests |
| `npm run test:integration` | Run RLS/RPC tests against local Supabase |
| `npm run test:e2e` | Build, start, and test public pages with Playwright/axe |
| `npm run db:start` | Start the local Supabase stack |
| `npm run db:reset` | Rebuild local Postgres from migration plus seed |
| `npm run db:push` | Apply pending migrations to the linked remote project |
| `npm run db:types` | Regenerate `lib/database.types.ts` from local Postgres |
| `npm run check:secrets` | Scan the client build for server-only values |
| `npm run check:responsive` | Run responsive smoke checks against a server |
| `npm run icons` | Regenerate PWA icons from the source logo |
| `npm run og-image` | Regenerate the social share image |

## Project layout

```text
app/
  (public)/       home schedule, rules, accessibility, login, registration
  (admin)/        dashboard, calendar, requests, trustees, access, managers, audit
  api/            public, admin, auth, and cron route handlers
  sw.ts           Serwist service worker source
components/
  admin/           manager workflows and editors
  chrome/          header, footer, navigation, and skip link
  pwa/             installation, offline, and service-worker UI
  request/         booking request modal and form
  schedule/        week/day schedule and event details
  trustees/        public trustee contacts
  ui/              shared primitives
lib/
  notifications/   email, push, logging, and fan-out
  supabase/        cookie, public, browser, and service-role clients
  validation/      shared Zod request schemas
messages/he.json   Hebrew interface strings
supabase/          CLI config, one migration, and one seed
tests/             unit, integration, and Playwright suites
```

## Security and data rules

- Row-level security is enabled on every application table.
- The service-role key is imported only by server-only modules. A custom ESLint
  rule prevents it from entering client components.
- Booking approval is atomic in Postgres, and an exclusion constraint prevents
  overlapping scheduled events within the same usage category.
- Public event projection omits unpublished requester notes and contact phone
  numbers before data reaches the browser.
- CSP, HSTS, frame protection, referrer policy, content-type protection, and a
  restrictive permissions policy are set in `next.config.ts`.
- Public writes use validation, bot protection, and rate limiting. Missing
  Upstash credentials fall back to Postgres-backed counters.
- Old requests are expired/anonymised by authenticated Vercel cron routes.

## Verification and deployment

The GitHub Actions workflow runs typecheck, lint, unit tests, a local Supabase
RLS matrix, the production build, client-secret scanning, Playwright, and axe.

Before deployment:

1. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and
   `npm run build`.
2. Start Docker, run `npm run db:reset`, then run
   `npm run test:integration`.
3. Set the bootstrap super-admin email before the first schema push.
4. Link the correct Supabase project and inspect `db:push --dry-run`.
5. Configure all production environment variables and OAuth redirect URLs.
6. Confirm Vercel cron jobs from `vercel.json` are enabled.
7. Run `npm run check:secrets` with real server-only values available.
8. Run `npm run test:e2e` against the production configuration.
9. Verify Supabase backups and perform a restore drill before launch.

Generated output (`.next/`, `public/sw.js`, `*.tsbuildinfo`, Playwright
reports, and coverage) is ignored and must not be committed.
