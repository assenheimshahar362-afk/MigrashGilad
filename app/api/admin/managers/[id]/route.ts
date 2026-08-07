import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { updateManagerInput } from '@/lib/validation/admin';
import { ok, parseBody } from '@/lib/api';

/**
 * `PATCH /api/admin/managers/[id]` — SUPER ADMIN only (§8).
 *
 * Every guard lives in `set_manager_role()` (§6.3), not here:
 *   - ERR_NOT_AUTHORIZED       — the RPC re-checks is_super_admin()
 *   - ERR_CANNOT_DEMOTE_SELF   — you may not demote or revoke yourself (sc. 14)
 *   - ERR_LAST_SUPER_ADMIN     — the deferred constraint trigger, on commit (sc. 15)
 *
 * `requireSuperAdmin()` above is the same defence-in-depth as the middleware:
 * it makes the 403 fast and legible. Deleting it would not open a hole — the
 * database would still refuse, which is scenario 13's whole point.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    await requireSuperAdmin();

    const { id } = await params;
    const input = await parseBody(request, updateManagerInput);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('set_manager_role', {
      p_allowlist_id: id,
      p_role: input.role ?? null,
      p_revoke: input.revoke ?? false,
    });

    if (error) return errorResponse(codeFromDbError(error));

    return ok({ manager: data });
  });
}
