import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportError } from '@/lib/errors';
import { emailAdminsAccessRequest } from '@/lib/notifications/email';
import type { AccessRequest, AccessRequestRow } from '@/lib/types';

/**
 * §2, self-service access.
 *
 * Someone who completes Google sign-in or confirms an email/password sign-up
 * but is not on `admin_allowlist` holds no permissions at all — RLS refuses
 * them every row. What they get instead is a row here, and the super admin
 * decides. The session is destroyed either way; nothing about being pending is
 * carried in a cookie.
 *
 * The insert uses the service role on purpose: the person making the request is
 * by definition not an admin yet, so no RLS policy could allow it, and adding
 * one that lets `authenticated` write this table would let any signed-in user
 * forge rows. There is no policy — only this code path.
 */
export async function recordAccessRequest(user: User): Promise<'created' | 'pending' | 'rejected'> {
  const email = user.email;
  if (!email) return 'rejected';

  const service = createAdminClient();

  const { data: existing } = await service
    .from('access_requests')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<AccessRequestRow>();

  // Already waiting: refresh who they are, do not queue a second row and do not
  // email the admins again. A person retrying sign-in twice a day must not turn
  // into two notifications a day.
  if (existing?.status === 'pending') {
    await service
      .from('access_requests')
      .update({ user_id: user.id, full_name: fullNameOf(user) ?? existing.full_name })
      .eq('id', existing.id);
    return 'pending';
  }

  // Already refused: they stay refused until a super admin adds them directly.
  // Silently re-queueing would let a rejected person spam the queue.
  if (existing?.status === 'rejected') return 'rejected';

  const { data: created, error } = await service
    .from('access_requests')
    .insert({
      email,
      full_name: fullNameOf(user),
      provider: user.app_metadata?.provider ?? 'password',
      user_id: user.id,
    })
    .select('*')
    .single<AccessRequestRow>();

  if (error || !created) {
    reportError(error, { where: 'recordAccessRequest', email });
    return 'pending';
  }

  // The email is the whole point of the feature, but a failed send must not
  // lose the request — the row is already committed and the queue in
  // /admin/access is the source of truth.
  try {
    await emailAdminsAccessRequest(created);
  } catch (sendError) {
    reportError(sendError, { where: 'recordAccessRequest.email', email });
  }

  return 'created';
}

function fullNameOf(user: User): string | null {
  const meta = user.user_metadata ?? {};
  return (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null;
}

/**
 * The queue for /admin/access. Read through the caller's session so
 * `access_requests_admin_read` decides whether they may see it at all; the
 * allowlist cross-check is a separate service-role read, because "this address
 * is already a manager" is a fact about a row the caller may not be able to
 * see once it is revoked.
 */
export async function listAccessRequests(): Promise<AccessRequest[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('access_requests')
    .select('*')
    .order('status')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const service = createAdminClient();
  const { data: admins } = await service
    .from('admin_allowlist')
    .select('email')
    .is('revoked_at', null);

  const active = new Set((admins ?? []).map((row) => row.email.toLowerCase()));

  return ((data ?? []) as AccessRequestRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    provider: row.provider,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    decidedNote: row.decided_note,
    alreadyAdmin: active.has(row.email.toLowerCase()),
  }));
}

/** True when the address has an active allowlist row — i.e. may sign in. */
export async function isApprovedEmail(email: string): Promise<boolean> {
  const service = createAdminClient();
  const { data } = await service
    .from('admin_allowlist')
    .select('id')
    .ilike('email', email)
    .is('revoked_at', null)
    .maybeSingle();

  return Boolean(data);
}
