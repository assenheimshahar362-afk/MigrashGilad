import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { recurringInput } from '@/lib/validation/admin';
import { ok, parseBody, revalidateSchedule } from '@/lib/api';

/**
 * `POST /api/admin/recurring` (§8). FR-34.
 *
 * Occurrences are materialised immediately on rule change as well as nightly by
 * cron, so an admin who creates a Tuesday allocation sees it in this week's
 * grid without waiting until 02:30.
 *
 * Weekday 5 (Friday) and 6 (Saturday) are accepted exactly like 0–4; scenario
 * 19 requires a Friday rule to materialise 120 days with no gaps.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const input = await parseBody(request, recurringInput);

    const supabase = await createClient();
    const { data: rule, error } = await supabase
      .from('recurring_rules')
      .insert({
        title: input.title,
        usage_type: input.usageType,
        weekday: input.weekday,
        start_time: input.startTime,
        end_time: input.endTime,
        valid_from: input.validFrom,
        valid_until: input.validUntil ?? null,
        is_active: input.isActive,
        contact_name: input.contactName ?? null,
        created_by: identity.userId,
      })
      .select('*')
      .single();

    if (error) return errorResponse(codeFromDbError(error));

    const { data: generated, error: materialiseError } = await supabase.rpc(
      'materialize_recurring',
      { p_horizon_days: 120 },
    );

    if (materialiseError) return errorResponse(codeFromDbError(materialiseError));

    revalidateSchedule();

    return ok({ rule, generated: (generated as number) ?? 0 }, 201);
  });
}

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const supabase = await createClient();
    const { data } = await supabase
      .from('recurring_rules')
      .select('*')
      .order('weekday')
      .order('start_time');
    return ok({ rules: data ?? [] });
  });
}
