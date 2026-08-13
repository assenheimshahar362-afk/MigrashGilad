import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { deleteRequestInput } from '@/lib/validation/admin';
import { ok, parseBody } from '@/lib/api';

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
 * `version` is still checked, same as approve/reject/cancel: it stops an
 * admin from deleting a row that a second admin just decided a moment
 * earlier, with no signal the state changed underneath them.
 *
 * Goes through `delete_request()` (a SECURITY DEFINER function), not a plain
 * table delete off the caller's own session — `audit_log` has no INSERT
 * policy for any authenticated role, only for functions that bypass RLS, so
 * this is the only way the deletion actually gets logged.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await params;
    const input = await parseBody(request, deleteRequestInput);

    const supabase = await createClient();
    const { error } = await supabase.rpc('delete_request', {
      p_request_id: id,
      p_version: input.version,
    });

    if (error) return errorResponse(codeFromDbError(error));

    return ok({ ok: true });
  });
}
