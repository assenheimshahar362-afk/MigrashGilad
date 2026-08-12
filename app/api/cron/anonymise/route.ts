import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { assertCronSecret } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok } from '@/lib/api';

/**
 * `POST /api/cron/anonymise` (§8, §16, §7). Scrubs the requester's name, phone
 * and note off any decided booking request older than 24 months.
 *
 * Used to be a manual, dry-run-first button on `/admin/settings` — the only
 * place this ever ran. Now that the settings screen is gone, this is what
 * keeps it running at all: without a cron entry here, old requester PII would
 * simply never get anonymised again.
 *
 * Vercel Cron issues a GET, so both verbs are exported and both are gated by
 * the shared secret — there is no session here to check, same as the other
 * two cron routes.
 */
async function run(request: Request) {
  return handleRoute(async () => {
    assertCronSecret(request);

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('anonymise_old_requests', { p_months: 24 });

    if (error) return errorResponse(codeFromDbError(error));

    return ok({ anonymised: (data as number) ?? 0 });
  });
}

export const POST = run;
export const GET = run;
