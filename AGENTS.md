<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project conventions

- Keep shared agent guidance in this file. Do not add Claude-specific project
  files or settings.
- The app is Hebrew, RTL-only, and mobile-first. Use logical CSS properties and
  preserve the custom RTL ESLint checks.
- Keep the Supabase service-role client server-only. Public browser code uses
  the anon client; privileged writes go through authenticated route handlers.
- Database source of truth is exactly
  `supabase/migrations/00000000000000_init.sql` plus `supabase/seed.sql`.
  Add schema changes to the baseline until the project adopts incremental
  migrations; never add ad-hoc SQL patches beside it.
- Do not edit generated files such as `.next/`, `next-env.d.ts`,
  `*.tsbuildinfo`, or `public/sw.js`.
- Before handoff, run `npm run typecheck`, `npm run lint`, `npm test`, and
  `npm run build`. Run the Supabase integration suite when Docker is available.
