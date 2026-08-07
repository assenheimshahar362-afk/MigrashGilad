import 'server-only';

import { reportError } from '@/lib/errors';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * FR-15: Cloudflare Turnstile in invisible mode; the server verifies the token.
 *
 * When TURNSTILE_SECRET_KEY is unset the check is skipped, so local development
 * and the test suite do not need a Cloudflare account. That is a deliberate
 * hole in development only — the deployment checklist (README) lists the key as
 * required for production, and `verifyTurnstile` logs loudly when it no-ops.
 */
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      reportError(new Error('TURNSTILE_SECRET_KEY is not set; bot protection is disabled'));
    }
    return true;
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(5000),
    });

    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    // Cloudflare being unreachable should not silently open the door.
    reportError(error, { where: 'turnstile' });
    return false;
  }
}
