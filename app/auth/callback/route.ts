import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminIdentity, touchAdminProfile } from '@/lib/auth';
import { recordAccessRequest } from '@/lib/access-requests';
import { reportError } from '@/lib/errors';

/**
 * The OAuth callback — and the email-confirmation landing — and the single most
 * important gate in the product.
 *
 * §2: being able to sign in with Google, or to confirm an email address,
 * grants NOTHING. The email must already exist in `admin_allowlist` with
 * `revoked_at is null`. Otherwise the user is signed out immediately —
 * acceptance scenario 16 requires that no session cookie survives.
 *
 * The sign-out is what makes that true: without it, a stranger who completed
 * Google sign-in would hold a valid Supabase session. RLS would still refuse
 * them every row, but leaving a live session for a non-admin is a bigger
 * surface than it needs to be.
 *
 * What is new is where they land: instead of a bare error, an unknown address
 * is filed as an access request and the super admin is emailed. The person is
 * told they are waiting, not that they were refused.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitiseNext(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=1`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    reportError(error, { where: 'auth/callback' });
    return NextResponse.redirect(`${origin}/login?error=1`);
  }

  const identity = await getAdminIdentity();

  if (!identity) {
    const outcome = data.user ? await recordAccessRequest(data.user) : 'rejected';
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?status=${outcome === 'rejected' ? 'refused' : 'pending'}`,
    );
  }

  // FR-36: the manager screen shows whether someone has ever signed in, and
  // when they were last seen. This is where both facts come from.
  await touchAdminProfile(identity);

  return NextResponse.redirect(`${origin}${next}`);
}

function sanitiseNext(next: string | null): string {
  if (!next || !next.startsWith('/admin')) return '/';
  return next;
}
