import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { settingsInput } from '@/lib/validation/admin';
import { sanitizeMemorialHtml } from '@/lib/sanitize';
import { ok, parseBody, revalidateSettings } from '@/lib/api';
import type { SiteSettingsRow } from '@/lib/types';

/**
 * `PATCH /api/admin/settings` — SUPER ADMIN only (§8, FR-37).
 *
 * FR-37a: opening hours are settable per day with different values per day, and
 * any day may be closed all day. The Zod schema requires all seven keys and the
 * `site_settings_opening_hours_guard` trigger requires them again — Friday and
 * Saturday cannot be dropped by a partial update at either layer.
 */
export async function PATCH(request: Request) {
  return handleRoute(async () => {
    const identity = await requireSuperAdmin();
    const input = await parseBody(request, settingsInput);

    const patch: Partial<SiteSettingsRow> = {
      updated_by: identity.userId,
      updated_at: new Date().toISOString(),
    };
    if (input.pitchName !== undefined) patch.pitch_name = input.pitchName;
    if (input.openingHours !== undefined) patch.opening_hours = input.openingHours;
    if (input.minLeadHours !== undefined) patch.min_lead_hours = input.minLeadHours;
    if (input.maxHorizonDays !== undefined) patch.max_horizon_days = input.maxHorizonDays;
    if (input.maxDurationMin !== undefined) patch.max_duration_min = input.maxDurationMin;
    if (input.requestsOpen !== undefined) patch.requests_open = input.requestsOpen;
    if (input.requestsClosedMsg !== undefined) patch.requests_closed_msg = input.requestsClosedMsg;
    if (input.memorialDays !== undefined) patch.memorial_days = input.memorialDays;

    // §7 rich text: sanitised server-side before storage, with the same strict
    // allowlist that runs again at render (app/(public)/memorial/page.tsx).
    if (input.memorialHtml !== undefined) {
      patch.memorial_html = input.memorialHtml ? sanitizeMemorialHtml(input.memorialHtml) : null;
    }

    const supabase = await createClient();
    const { data: before } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('site_settings')
      .update(patch)
      .eq('id', 1)
      .select('*')
      .single();

    if (error) return errorResponse(codeFromDbError(error));

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'site_settings',
      action: 'update',
      before,
      after: data,
    });

    revalidateSettings();

    return ok({ settings: data });
  });
}
