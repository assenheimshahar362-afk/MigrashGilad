import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { approveInput } from '@/lib/validation/admin';
import { ok, parseBody, revalidateSchedule } from '@/lib/api';

/**
 * `POST /api/admin/requests/[id]/approve` (§8).
 *
 * FR-21: approving creates an event ATOMICALLY with the status change — one
 * transaction, one RPC. That is why this handler does almost nothing: all the
 * interesting behaviour is inside `approve_request()` (§6.3), where it can be
 * a single transaction rather than three round trips that can fail between.
 *
 * FR-20: the first decision wins, resolved by an optimistic-concurrency check
 * on `version`; the loser gets ERR_ALREADY_DECIDED (scenario 3).
 * FR-23: passing start/end counter-offers, which sets `approved_modified`.
 *
 * The call goes through the caller's own session, not the service role, so
 * `is_admin()` inside the RPC evaluates the real identity.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    await requireAdmin();

    const { id } = await params;
    const input = await parseBody(request, approveInput);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('approve_request', {
      p_request_id: id,
      p_version: input.version,
      p_start: input.start ?? null,
      p_end: input.end ?? null,
      p_note: input.note ?? null,
      p_show_note: input.showNote,
    });

    // 23P01 (exclusion violation) is mapped to ERR_SLOT_CONFLICT here as well
    // as inside the RPC — scenario 4 requires that no partial state exists, and
    // the transaction rolling back is what guarantees it.
    if (error) return errorResponse(codeFromDbError(error));

    revalidateSchedule();

    return ok({ event: data });
  });
}
