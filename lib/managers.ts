import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AdminIdentity, Manager, ManagerRow } from '@/lib/types';

/**
 * The manager list, assembled once for both `/admin/managers` (§10.8) and
 * `GET /api/admin/managers` (§8), so the two cannot disagree about who is
 * active or who counts as "self".
 *
 * The allowlist read goes through the caller's session, so `allowlist_admin_read`
 * decides whether they may see it at all. The `admin_profiles` read needs the
 * service role: FR-36 requires showing whether someone has EVER signed in, and
 * a row that does not exist yet is exactly that signal — a fact about the
 * absence of a record, which RLS-filtered reads cannot distinguish from "no
 * permission".
 */
export async function listManagers(identity: AdminIdentity): Promise<Manager[]> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from('admin_allowlist')
    .select('*')
    .order('role', { ascending: false })
    .order('created_at');

  if (error) throw error;

  const service = createAdminClient();
  const { data: profiles } = await service.from('admin_profiles').select('email, last_seen');

  const seen = new Map(
    (profiles ?? []).map((profile) => [profile.email.toLowerCase(), profile.last_seen]),
  );

  return ((rows ?? []) as ManagerRow[]).map((row) => {
    const key = row.email.toLowerCase();
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      revokedAt: row.revoked_at,
      lastSeen: seen.get(key) ?? null,
      hasSignedIn: seen.has(key),
      // §10.8: the signed-in super admin's own row is visibly marked, and its
      // demote/revoke controls disabled — prevented, not explained afterwards.
      isSelf: row.id === identity.allowlistId,
    };
  });
}
