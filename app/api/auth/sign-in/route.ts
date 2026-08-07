import { AppError, handleRoute, reportError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { ok, parseBody } from '@/lib/api';
import { signInInput } from '@/lib/validation/auth';
import { getAdminIdentity, touchAdminProfile } from '@/lib/auth';
import { recordAccessRequest } from '@/lib/access-requests';
import { clientIp, consume, hashIp, IP_RULE } from '@/lib/rate-limit';

/**
 * `POST /api/auth/sign-in` — email + password.
 *
 * This runs on the server rather than in the browser for one reason: the
 * allowlist check and the sign-out have to happen inside the same request that
 * created the session. Doing it client-side would leave a live Supabase session
 * in the browser for the moment between "signed in" and "found not to be an
 * admin", and a client that simply never called the second step would keep it.
 *
 * §2 / scenario 16: a valid password grants NOTHING on its own. Not on the
 * allowlist means the session is destroyed here, and the address is filed as an
 * access request for a super admin to decide.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const input = await parseBody(request, signInInput);

    if (!(await consume(IP_RULE(hashIp(clientIp(request)))))) {
      throw new AppError('ERR_RATE_LIMITED');
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user) {
      // One message for "no such account", "wrong password" and "email not
      // confirmed": all three are the same answer to someone guessing.
      reportError(error, { where: 'auth/sign-in' });
      throw new AppError('ERR_BAD_CREDENTIALS');
    }

    const identity = await getAdminIdentity();

    if (!identity) {
      const outcome = await recordAccessRequest(data.user);
      await supabase.auth.signOut();
      throw new AppError(outcome === 'rejected' ? 'ERR_NOT_AUTHORIZED' : 'ERR_PENDING_APPROVAL');
    }

    // FR-36: the manager screen shows whether someone has ever signed in.
    await touchAdminProfile(identity);

    return ok({ status: 'signed_in' });
  });
}
