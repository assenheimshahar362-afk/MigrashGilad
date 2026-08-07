import { AppError, handleRoute, errorResponse, reportError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { ok, parseBody } from '@/lib/api';
import { signUpInput } from '@/lib/validation/auth';
import { absoluteUrl } from '@/lib/utils';
import { clientIp, consume, hashIp, IP_RULE } from '@/lib/rate-limit';

/**
 * `POST /api/auth/sign-up` — email + password.
 *
 * Two gates stand between this call and any permission, in this order:
 *
 *   1. Supabase sends a confirmation link. An unconfirmed address never
 *      reaches the admins' inbox, so a typo'd or forged address costs them
 *      nothing.
 *   2. Confirming lands on /auth/callback, which files the access request and
 *      signs the session out again. Only `decide_access_request()` can turn
 *      that into an `admin_allowlist` row.
 *
 * Signing up therefore grants NOTHING, which is the same guarantee §2 has
 * always made about Google sign-in.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const input = await parseBody(request, signUpInput);

    // The expensive part of this route is Supabase's mail send, and it is a
    // free unauthenticated surface, so it is limited per IP and per address —
    // the address bound alone would let one host walk a list of them.
    const [ipOk, emailOk] = await Promise.all([
      consume(IP_RULE(hashIp(clientIp(request)))),
      consume({ key: `signup:${input.email.toLowerCase()}`, limit: 3, windowSeconds: 60 * 60 }),
    ]);
    if (!ipOk || !emailOk) throw new AppError('ERR_RATE_LIMITED');

    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.fullName },
        emailRedirectTo: absoluteUrl('/auth/callback'),
      },
    });

    if (error) {
      // Supabase returns the same shape whether the address is new or already
      // registered when confirmations are on, and we do not add a distinction:
      // "that email already has an account" is an account-enumeration oracle.
      reportError(error, { where: 'auth/sign-up' });
      return errorResponse('ERR_VALIDATION');
    }

    return ok({ status: 'confirm_email' }, 202);
  });
}
