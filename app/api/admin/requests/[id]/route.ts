import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ok } from '@/lib/api';

/**
 * `DELETE /api/admin/requests/[id]` (§8).
 *
 * Housekeeping, not a decision: removes the row outright — spam, duplicates,
 * test submissions — whatever its status. Unlike approve/reject/cancel this
 * leaves no `booking_requests` row and no visitor-facing effect (there is no
 * requester-facing status page any more, § request flow revision). If the
 * request was ever approved, its `events` row is untouched: the FK is
 * `on delete set null`, so an already-scheduled booking is never pulled off
 * the calendar as a side effect of deleting the request that created it.
 *
 * Goes through `delete_request()` (a SECURITY DEFINER function), not a plain
 * table delete off the caller's own session — `audit_log` has no INSERT
 * policy for any authenticated role, only for functions that bypass RLS, so
 * this is the only way the deletion actually gets logged.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await params;

    const supabase = await createClient();
    const { error } = await supabase.rpc('delete_request', { p_request_id: id });

    if (error) return errorResponse(codeFromDbError(error));

    return ok({ ok: true });
  });
}
