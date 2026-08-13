import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requiredEnv } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * §7: this is server-only and must never be imported into a "use client" file.
 * Three things enforce that, in increasing order of reliability:
 *   1. the `server-only` import above — a build error if a client module pulls it in
 *   2. an ESLint `no-restricted-imports` rule on components (eslint.config.mjs)
 *   3. `npm run check:secrets`, which greps the built client bundle in CI (NFR-6)
 *
 * Legitimate callers are the public write surface (§7) — POST /api/requests,
 * which needs to touch `booking_requests` with no session — plus the cron
 * routes and the notification fan-out.
 */
let cached: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createAdminClient() {
  if (!cached) {
    cached = createSupabaseClient<Database>(
      requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return cached;
}
