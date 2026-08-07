import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requiredEnv } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

/**
 * A cookieless anon-key client for the cached public reads (NFR-3).
 *
 * The cookie-bound client in `./server` calls `cookies()`, which is a dynamic
 * data source; Next.js refuses to let one be read inside `unstable_cache`, and
 * rightly so — a cache entry keyed on nothing but the date range would
 * otherwise be filled from whichever visitor happened to warm it.
 *
 * That restriction is a good fit for what these reads actually are. The
 * schedule, the trustee list and the public settings are identical for every
 * visitor, are covered by anon-readable RLS policies (§6.4), and must be
 * readable with no login at all (FR-7). Nothing here should vary by session,
 * so nothing here reads one.
 */
let cached: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createPublicClient() {
  if (!cached) {
    cached = createSupabaseClient<Database>(
      requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return cached;
}
