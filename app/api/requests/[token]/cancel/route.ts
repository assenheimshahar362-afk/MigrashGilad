import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { handleRoute, errorResponse, codeFromDbError } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIp, consume, hashIp, IP_RULE } from '@/lib/rate-limit';
import { SCHEDULE_TAG } from '@/lib/data';

/**
 * `POST /api/requests/[token]/cancel` (§8) — the second and last public write
 * surface (§7). Rate-limited; token-only, so no Turnstile challenge (a person
 * holding the link has already been through one).
 *
 * §5: `pending` is the only state from which a requester may cancel. That rule
 * lives in `cancel_request_public()`, not here — this route cannot be tricked
 * into cancelling an approved booking by any input it accepts.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return handleRoute(async () => {
    const { token } = await params;
    if (!token || token.length < 24) return errorResponse('ERR_NOT_FOUND');

    if (!(await consume(IP_RULE(hashIp(clientIp(request)))))) {
      return errorResponse('ERR_RATE_LIMITED');
    }

    const supabase = createAdminClient();
    const { error } = await supabase.rpc('cancel_request_public', { p_token: token });

    if (error) return errorResponse(codeFromDbError(error));

    revalidateTag(SCHEDULE_TAG, 'max');

    return NextResponse.json({ status: 'cancelled' as const });
  });
}
