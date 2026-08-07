'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

/**
 * Browser client, anon key only. Used for the admin realtime subscription
 * (§10.7) and the OAuth redirect. It can never see `booking_requests` unless
 * the session belongs to an active admin, because RLS says so — the browser is
 * not trusted to filter.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
