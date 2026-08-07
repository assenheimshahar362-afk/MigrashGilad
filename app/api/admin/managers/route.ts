import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin, requireSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { listManagers } from '@/lib/managers';
import { addManagerInput } from '@/lib/validation/admin';
import { ok, parseBody } from '@/lib/api';

/**
 * `GET /api/admin/managers` — admin. §2: an admin can READ the list but never
 * write to it. That asymmetry is enforced by RLS (`allowlist_admin_read` exists,
 * no update or delete policy exists at all), not by this handler.
 */
export async function GET() {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    return ok({ managers: await listManagers(identity) });
  });
}

/**
 * `POST /api/admin/managers` — SUPER ADMIN only.
 *
 * FR-36: adding a manager takes an email only; the account materialises on
 * their first Google sign-in. There is no invitation email to send, because
 * being on the list IS the invitation (§2).
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    await requireSuperAdmin();
    const input = await parseBody(request, addManagerInput);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('add_manager', {
      p_email: input.email,
      p_full_name: input.fullName ?? null,
      p_role: input.role,
    });

    if (error) return errorResponse(codeFromDbError(error));

    return ok({ manager: data }, 201);
  });
}
