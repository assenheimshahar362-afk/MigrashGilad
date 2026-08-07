import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { assertCronSecret } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, revalidateSchedule } from '@/lib/api';

/**
 * `POST /api/cron/materialize` (§8, §16). FR-34: generated occurrences are
 * materialised up to 120 days ahead by a scheduled job.
 *
 * Idempotent by construction (`events_recurring_occurrence_idx`), so a double
 * run, a retry or an overlapping manual trigger from /admin/settings all
 * produce the same result.
 */
async function run(request: Request) {
  return handleRoute(async () => {
    assertCronSecret(request);

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('materialize_recurring', {
      p_horizon_days: 120,
    });

    if (error) return errorResponse(codeFromDbError(error));

    revalidateSchedule();

    return ok({ created: (data as number) ?? 0 });
  });
}

export const POST = run;
export const GET = run;
