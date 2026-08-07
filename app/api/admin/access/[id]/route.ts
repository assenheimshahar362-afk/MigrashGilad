import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { accessDecisionInput } from '@/lib/validation/auth';
import { ok, parseBody } from '@/lib/api';

/**
 * `PATCH /api/admin/access/[id]` — SUPER ADMIN only.
 *
 * The handler carries no logic beyond validation: `decide_access_request()`
 * re-checks `is_super_admin()`, refuses an already-decided row, writes the
 * allowlist entry and files both audit rows in one transaction. Doing the
 * approval here in two statements would leave a window where the request is
 * approved but the allowlist is not written.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    await requireSuperAdmin();
    const { id } = await params;
    const input = await parseBody(request, accessDecisionInput);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('decide_access_request', {
      p_request_id: id,
      p_approve: input.approve,
      p_role: input.role,
      p_note: input.note ?? null,
    });

    if (error) return errorResponse(codeFromDbError(error));

    return ok({ request: data });
  });
}
