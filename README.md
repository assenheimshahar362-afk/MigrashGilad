# מגרש גלעד — Migrash Gilad

Community football pitch management PWA. Hebrew, RTL-only, mobile-first.

Built to the specification in `migrash-gilad-spec.md` v1.0. Requirement numbers
(`FR-x`, `NFR-x`, `A11Y-x`) are cited in the code at the point they are
satisfied, so a change to a rule is traceable to the lines that implement it.

---

## What this is

A single public schedule for one pitch, plus a lightweight request-and-approval
workflow. A resident sees who has the pitch this week without logging in, and
can ask for a slot with a name and a phone number. Managers approve or reject
from a phone.

Three tiers, and nothing between them:

| Tier | Auth | Can |
|---|---|---|
| **visitor** | none, ever | view the schedule; submit and cancel a request via a tokenised link |
| **admin** | Google OAuth **or** email + password, email on the allowlist | decide requests, manage events, recurring rules, closures, trustees |
| **super admin** | same, `role = 'super_admin'` | manage admins, access requests, settings, memorial content, audit log, maintenance |

There is no visitor account. Anyone may *ask* for access — the header carries a
sign-in icon and `/login` offers Google and email + password — but signing up
grants nothing:

1. email + password sign-ups must confirm the address (Supabase mail);
2. Google sign-in and email confirmation both land on `/auth/callback`, which
   files an `access_requests` row, emails the super admins, and **signs the
   session out**;
3. a super admin approves in `/admin/access`, which is the only path that writes
   an `admin_allowlist` row — `decide_access_request()` in migration 0002.

`is_admin()` still reads `admin_allowlist` and nothing else, so a pending or
rejected person has exactly the permissions of a stranger.

---

## Quick start

```bash
npm install
cp .env.example .env.local        # fill in the Supabase values at minimum

# Local database: applies supabase/migrations/0001_init.sql, then seeds
supabase start
npm run db:reset

npm run dev
```

Open <http://localhost:3000>.

Without a Supabase project the public pages still render — reads fail closed to
an empty schedule and the seeded default settings, so the app degrades rather
than crashing (NFR-3). Requests will not submit.

### Required before anything works

| Variable | Why |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | every read |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | every read |
| `SUPABASE_SERVICE_ROLE_KEY` | the two public write endpoints, cron, notification fan-out |

The one bootstrap super admin (§2) is not an environment variable — it is a
literal in `supabase/migrations/0001_init.sql`, under "PART 4 — BOOTSTRAP".

Everything else in `.env.example` is optional and degrades explicitly:

- **No `TURNSTILE_SECRET_KEY`** → bot protection is skipped, and logged as an
  error in production. Set it before launch.
- **No `RESEND_API_KEY`** / **no VAPID keys** → that notification channel writes
  a `failed` row to `notification_log` and the others still run. The dashboard
  badge means no request is ever lost (§9.1).
- **No Upstash** → rate limiting uses the `rate_limits` Postgres table instead.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build (also bundles the service worker) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, including the RTL and service-role-import rules |
| `npm test` | unit tests — time, phone, schemas, error mapping. No Docker needed |
| `npm run test:integration` | RLS policy matrix and RPCs, against local Supabase |
| `npm run test:e2e` | Playwright, RTL locale, axe-core on every public page |
| `npm run check:secrets` | greps the built client bundle for server-only values |
| `npm run icons` | regenerates every icon from `public/images/logo.png` |

---

## Architecture, and why

### The database is the authority, not the app

Three rules are enforced in Postgres and only *reflected* in the UI:

- **No double-booking (G4).** `events_no_overlap` is a GiST exclusion constraint
  on `tstzrange(starts_at, ends_at)` where `status = 'scheduled'`. Two
  overlapping inserts fail at the database even from raw SQL. The app maps
  SQLSTATE `23P01` to `ERR_SLOT_CONFLICT` everywhere events are written.
- **Approval is atomic (FR-21).** `approve_request()` creates the event and
  flips the request status in one transaction. If the slot went while the admin
  was deciding, the whole thing rolls back — there is no state where a request
  is approved and no event exists.
- **The last super admin cannot be removed (FR-36a).** A *deferred* constraint
  trigger checks, at commit, that at least one active `super_admin` remains, and
  `set_manager_role()` refuses self-demotion. `admin_allowlist` has no `UPDATE`
  or `DELETE` policy at all; the RPC is the only write path.

Middleware and the `requireAdmin()` / `requireSuperAdmin()` helpers are defence
in depth. Deleting them would not open a hole.

### Roles are resolved per request

Never from a JWT claim. `getAdminIdentity()` reads `admin_allowlist` on every
request, so revoking an admin takes effect on their next navigation rather than
when their token happens to expire.

### Time

Everything is stored UTC and converted at the edges, in `lib/time.ts` and
nowhere else. The rule that matters: **never add hours to a local wall-clock
string.** Israel changes offset twice a year, so `18:00 + 2h` is not a fixed
number of UTC hours. All conversions go through `fromZonedTime` with
`Asia/Jerusalem` explicit. `tests/unit/time.test.ts` pins both 2026 transitions.

### All seven days are operating days

Friday and Saturday are ordinary days with the same booking rules, opening-hours
structure and visual treatment as the rest of the week. There is deliberately no
weekday branch anywhere in `lib/schedule.ts`, `week-grid.tsx`, or
`materialize_recurring()`. There is **no automatic Shabbat or chag closure** — a
holiday closure is entered by hand like any other, and no Hebrew-calendar
library is imported to compute one.

### Caching

The public schedule is server-rendered and cached under a `schedule` tag,
revalidated on every write. It survives a Supabase outage from cache (NFR-3).
Cached reads use a *cookieless* anon client (`lib/supabase/public.ts`) — Next.js
forbids reading cookies inside `unstable_cache`, and these responses are
identical for every visitor anyway.

### RTL

`dir="rtl"` at the root, logical properties everywhere. Physical-direction
Tailwind classes (`ml-`, `left-`, `text-right`, …) are an **ESLint error**, not
a review comment: in an RTL-only product they are always a bug and are invisible
to anyone testing in English. Times and phone numbers are wrapped in `<bdi>`
(`components/ui/ltr.tsx`) or `+972` renders as `972+`.

---

## Layout

```
app/
  (public)/          schedule, month, request, status, trustees, about, rules, a11y
  (admin)/           dashboard, calendar, recurring, closures, trustees, requests,
                     managers, settings, audit    [auth; last three super admin only]
  api/               §8 contract — public routes, admin routes, cron
  sw.ts              Serwist service worker
components/
  schedule/          week grid (the signature element), month grid, day list, now marker
  request/           form, availability hint, success panel, status card
  admin/             request card, editors, manager table, settings form
  ui/                primitives — button, field, sheet, LTR isolation, status pill
lib/
  time.ts            every Asia/Jerusalem conversion in the product
  schedule.ts        opening hours, availability, request-window rules
  validation/        Zod schemas shared by client and server
  errors.ts          error code → Hebrew message
  supabase/          server (cookie), public (cookieless, cached), admin (service role), client
messages/he.json     every Hebrew string in the UI
supabase/           0001_init.sql (schema · functions · RLS · bootstrap) · seed.sql
tests/               unit · integration (RLS matrix) · e2e (Playwright + axe)
```

---

## Runbook

### Add an admin

`/admin/managers` → **הוספת מנהל** → their Google address. The row appears as
`טרם התחבר` until they sign in once; the account materialises on first sign-in.
No invitation email is sent — being on the list *is* the invitation.

### Approve someone who signed up

`/admin/access` (super admin only). Each pending row shows the name, address and
which method they used. **אישור** writes the allowlist row and the audit entries
in one transaction; **דחייה** marks the request rejected and a rejected address
cannot re-queue itself — add it from `/admin/managers` if you change your mind.
The notification email deliberately carries no approve link: approving grants
admin rights, so it happens signed in, never from whoever holds the inbox.

### Remove an admin

Same screen → **הסרת הרשאה**. This is a soft revoke (`revoked_at`), never a
delete, so the audit trail stays intact. You cannot revoke your own row, and you
cannot remove the last active super admin; both are refused by the database.

### Pause requests

`/admin/settings` → uncheck **הגשת בקשות פתוחה** and write a reason. The public
CTA is replaced by that message immediately.

### Close the pitch for a day

`/admin/closures`. All-day or a time range, with an explicit choice about
cancelling the bookings inside it — the confirmation lists them by name first.
This is also how you close for a holiday or for Shabbat; nothing is automatic.

### Restore a backup

Supabase runs daily automated backups (NFR-8). Restore from the Supabase
dashboard → Database → Backups. After restoring, run the maintenance action
**יצירת מופעים חוזרים מחדש** from `/admin/settings` — materialisation is
idempotent, so re-running it is always safe and fills any gap in generated
occurrences.

### A request was not notified

`notification_log` records every attempt with its failure. The dashboard badge
is derived from the pending queue, not from notifications, so the request is
still there. Check `RESEND_API_KEY` and the VAPID keys.

### Web Push on iOS is not working

Expected unless the admin has **installed the app to their home screen** and is
on iOS 16.4+. `/admin` detects this and explains it in Hebrew rather than
offering a button that would silently do nothing.

---

## Open decisions

These are unresolved in the spec (§21) and are marked in the code where they
bite. None of them blocks the build; all of them block launch.

| # | Question | Blocks |
|---|---|---|
| 1 | Does the association manage its own hours? If yes, that is a fourth tier (`scoped_admin`) in v1.1 — not a variation of `admin`. | role model |
| 2 | Automated SMS to requesters — budget approved? v1 ships the one-tap WhatsApp link plus the status page. | `lib/notifications/whatsapp.ts` |
| 3 | Memorial text, portrait, family approval. The memorial section of `/about` shows an honest placeholder until settings carry the content. | launch |
| 5 | Which emails are on the `admin` tier. | `/admin/managers` |
| 6 | Real trustee names, titles, phones, photos. `supabase/seed.sql` has placeholders. | `/trustees` |
| 7 | Opening hours per weekday, max duration, lead time. Seeded at 06:00–23:00 every day. | `/admin/settings` |
| 8 | Domain and DNS. | deployment |
| 9 | Named accessibility coordinator. `/accessibility` has bracketed placeholders that cannot ship unnoticed. | legal (A11Y-9) |

---

## Deployment checklist

1. Supabase project created; `supabase db push` applied `0001_init.sql` and
   `0002_access_requests.sql` — or the same files pasted whole into the
   dashboard SQL editor, which also works.
2. The super admin address edited into "PART 4 — BOOTSTRAP" in `0001_init.sql`
   **before** that first run. There is no UI that can create the first one.
3. Google OAuth configured in Supabase Auth → Providers, redirect URL set to
   `https://<domain>/auth/callback`.
3a. Supabase Auth → Providers → Email: enabled with **Confirm email** ON, and
   `https://<domain>/auth/callback` added to the redirect allowlist. With
   confirmations off, an unverified address would reach the approval queue.
3b. `RESEND_API_KEY` and `NOTIFY_FROM_EMAIL` set, or nobody is told a request
   is waiting — the queue at `/admin/access` still holds it either way.
4. All environment variables from `.env.example` set in Vercel.
5. `vercel.json` crons active (expire at 02:00, materialise at 02:30).
6. Icons generated — `npm run icons` cuts the badge out of
   `public/images/logo.png` and writes the manifest PNGs, the favicon
   (`app/icon.png`), the apple-touch icon and the header mark. Re-run it after
   replacing the logo; the disc's centre and radius are constants at the top of
   `scripts/generate-icons.mjs` and would need remeasuring for new artwork.
7. Accessibility coordinator named in `app/(public)/accessibility/page.tsx`.
8. Memorial content supplied and approved by the family.
9. Lighthouse checked against NFR-2: Performance ≥ 90, Accessibility 100.
