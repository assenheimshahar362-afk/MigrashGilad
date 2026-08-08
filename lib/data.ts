import 'server-only';

import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportError } from '@/lib/errors';
import {
  FALLBACK_SETTINGS,
  toPublicClosure,
  toPublicEvent,
  toPublicSettings,
  type ClosureRow,
  type EventRow,
  type PublicClosure,
  type PublicEvent,
  type PublicSettings,
  type SiteSettingsRow,
  type TrusteeRow,
} from '@/lib/types';
import { addLocalDays, toInstant, type LocalDate } from '@/lib/time';

/**
 * Server-side reads for the public site. Everything here goes through the anon
 * key and is therefore subject to the same RLS policies as the browser would
 * be — if a policy is wrong, these break too, rather than papering over it.
 *
 * NFR-3: the public schedule is cached and revalidated on write, so it survives
 * a Supabase outage from cache.
 */
export const SCHEDULE_TAG = 'schedule';
export const SETTINGS_TAG = 'settings';
export const TRUSTEES_TAG = 'trustees';

async function fetchScheduleUncached(from: LocalDate, to: LocalDate) {
  const supabase = createPublicClient();

  // The window is widened by a day on each side so an event starting late on
  // the previous local day, or ending early on the next, is still returned.
  const rangeStart = toInstant(addLocalDays(from, -1), '00:00').toISOString();
  const rangeEnd = toInstant(addLocalDays(to, 2), '00:00').toISOString();

  const [eventsResult, closuresResult] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('status', 'scheduled')
      .gte('starts_at', rangeStart)
      .lt('starts_at', rangeEnd)
      .order('starts_at', { ascending: true }),
    supabase
      .from('closures')
      .select('*')
      .lt('starts_at', rangeEnd)
      .gt('ends_at', rangeStart)
      .order('starts_at', { ascending: true }),
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (closuresResult.error) throw closuresResult.error;

  return {
    events: (eventsResult.data as EventRow[]).map(toPublicEvent),
    closures: (closuresResult.data as ClosureRow[]).map(toPublicClosure),
  };
}

export async function getSchedule(
  from: LocalDate,
  to: LocalDate,
): Promise<{ events: PublicEvent[]; closures: PublicClosure[] }> {
  const cached = unstable_cache(
    () => fetchScheduleUncached(from, to),
    ['schedule', from, to],
    { tags: [SCHEDULE_TAG], revalidate: 300 },
  );

  try {
    return await cached();
  } catch (error) {
    reportError(error, { where: 'getSchedule', from, to });
    return { events: [], closures: [] };
  }
}

async function fetchSettingsUncached(): Promise<PublicSettings> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle<SiteSettingsRow>();

  if (error || !data) {
    if (error) reportError(error, { where: 'getSettings' });
    return FALLBACK_SETTINGS;
  }
  return toPublicSettings(data);
}

export async function getSettings(): Promise<PublicSettings> {
  const cached = unstable_cache(fetchSettingsUncached, ['settings'], {
    tags: [SETTINGS_TAG],
    revalidate: 300,
  });
  try {
    return await cached();
  } catch (error) {
    reportError(error, { where: 'getSettings' });
    return FALLBACK_SETTINGS;
  }
}

/** The full settings row, including memorial HTML. Super admin screens only. */
export async function getSettingsRow(): Promise<SiteSettingsRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle<SiteSettingsRow>();
  return data ?? null;
}

async function fetchTrusteesUncached(): Promise<TrusteeRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('trustees')
    .select('*')
    .eq('is_archived', false)
    .order('is_primary', { ascending: false })
    .order('display_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as TrusteeRow[];
}

export async function getTrustees(): Promise<TrusteeRow[]> {
  const cached = unstable_cache(fetchTrusteesUncached, ['trustees'], {
    tags: [TRUSTEES_TAG],
    revalidate: 600,
  });
  try {
    return await cached();
  } catch (error) {
    reportError(error, { where: 'getTrustees' });
    return [];
  }
}

/**
 * Public status page lookup. Goes through the service role because
 * `booking_requests` has no anon policy at all (§6.4) — the token, not the
 * database role, is the authorisation.
 */
export async function getRequestByToken(token: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();
  return data ?? null;
}
