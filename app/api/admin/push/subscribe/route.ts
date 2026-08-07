import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { pushSubscriptionInput } from '@/lib/validation/admin';
import { ok, parseBody } from '@/lib/api';

/**
 * `POST /api/admin/push/subscribe` (§8, §9.1).
 *
 * `push_self` RLS restricts a row to its own user, and `endpoint` is unique, so
 * re-subscribing the same browser updates rather than accumulating rows — which
 * matters because the browser rotates the endpoint on its own schedule.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const input = await parseBody(request, pushSubscriptionInput);

    const supabase = await createClient();
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: identity.userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        user_agent: input.userAgent ?? null,
      },
      { onConflict: 'endpoint' },
    );

    if (error) return errorResponse(codeFromDbError(error));

    return ok({ ok: true });
  });
}

export async function DELETE(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    if (!endpoint) return errorResponse('ERR_VALIDATION');

    const supabase = await createClient();
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);

    return ok({ ok: true });
  });
}
