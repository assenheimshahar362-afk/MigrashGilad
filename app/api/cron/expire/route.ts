import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { assertCronSecret } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, revalidateSchedule } from '@/lib/api';

/**
 * `POST /api/cron/expire` (§8, §16). FR-26: pending requests older than the
 * requested date auto-expire.
 *
 * Vercel Cron issues a GET, so both verbs are exported and both are gated by
 * the shared secret — there is no session here to check.
 */
async function run(request: Request) {
  return handleRoute(async () => {
    assertCronSecret(request);

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('expire_stale_requests');

    if (error) return errorResponse(codeFromDbError(error));

    revalidateSchedule();

    return ok({ expired: (data as number) ?? 0 });
  });
}

export const POST = run;
export const GET = run;
