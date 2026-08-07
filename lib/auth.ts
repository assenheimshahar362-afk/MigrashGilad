import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/errors';
import type { AdminIdentity, ManagerRow } from '@/lib/types';

/**
 * §2: role is resolved server-side on every request from `admin_allowlist`,
 * never from a JWT claim the client could stale-cache, and never from a
 * client-side flag. Revoking an admin takes effect on their very next request,
 * not when their token happens to expire.
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  // Read through the service role: the allowlist lookup must succeed even for
  // a signed-in user who turns out NOT to be on it, and `allowlist_admin_read`
  // is gated on is_admin(), which would make that lookup return nothing.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('admin_allowlist')
    .select('id, email, full_name, role, revoked_at')
    .ilike('email', user.email)
    .is('revoked_at', null)
    .maybeSingle<Pick<ManagerRow, 'id' | 'email' | 'full_name' | 'role' | 'revoked_at'>>();

  if (error || !data) return null;

  return {
    userId: user.id,
    email: data.email,
    fullName: data.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    role: data.role,
    allowlistId: data.id,
  };
}

/** Throws ERR_NOT_AUTHORIZED unless the caller is an active admin. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const identity = await getAdminIdentity();
  if (!identity) throw new AppError('ERR_NOT_AUTHORIZED');
  return identity;
}

/** Throws ERR_SUPER_ONLY unless the caller is an active super admin. */
export async function requireSuperAdmin(): Promise<AdminIdentity> {
  const identity = await requireAdmin();
  if (identity.role !== 'super_admin') throw new AppError('ERR_SUPER_ONLY');
  return identity;
}

/**
 * Record the sign-in so `/admin/managers` can show "last seen" and distinguish
 * an invited-but-never-arrived row from an active one (FR-36).
 */
export async function touchAdminProfile(identity: AdminIdentity): Promise<void> {
  const admin = createAdminClient();
  await admin.from('admin_profiles').upsert(
    {
      user_id: identity.userId,
      email: identity.email,
      full_name: identity.fullName,
      avatar_url: identity.avatarUrl,
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}

/** §16 cron routes are protected by a shared secret, not a session. */
export function assertCronSecret(request: Request): void {
  const expected = process.env.CRON_SECRET;
  if (!expected) throw new AppError('ERR_NOT_AUTHORIZED');

  const header = request.headers.get('authorization');
  if (header !== `Bearer ${expected}`) throw new AppError('ERR_NOT_AUTHORIZED');
}
