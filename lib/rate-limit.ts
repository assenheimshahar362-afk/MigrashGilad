import 'server-only';

import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportError } from '@/lib/errors';

/**
 * FR-14: max 3 requests per phone number per 24 h, max 10 per IP per hour.
 *
 * Upstash is used when configured; otherwise the `rate_limits` table is the
 * backend, so the product works with one fewer paid service (§15). Both share
 * the same fixed-window semantics, which is coarse but correct for a limit
 * whose job is to stop a person spamming a form, not to shape traffic.
 */
export interface RateLimitRule {
  key: string;
  limit: number;
  windowSeconds: number;
}

export const PHONE_RULE = (phone: string): RateLimitRule => ({
  key: `phone:${phone}`,
  limit: 3,
  windowSeconds: 24 * 60 * 60,
});

export const IP_RULE = (ipHash: string): RateLimitRule => ({
  key: `ip:${ipHash}`,
  limit: 10,
  windowSeconds: 60 * 60,
});

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

/** True when the caller is still within the limit. */
export async function consume(rule: RateLimitRule): Promise<boolean> {
  try {
    const client = getRedis();
    return client ? await consumeRedis(client, rule) : await consumePostgres(rule);
  } catch (error) {
    // A rate limiter that is down must not take the request form down with it.
    // Failing open is the deliberate choice: the write surface behind it is
    // still Turnstile-verified and admin-moderated.
    reportError(error, { where: 'rate-limit', key: rule.key });
    return true;
  }
}

async function consumeRedis(client: Redis, rule: RateLimitRule): Promise<boolean> {
  const count = await client.incr(rule.key);
  if (count === 1) {
    await client.expire(rule.key, rule.windowSeconds);
  }
  return count <= rule.limit;
}

async function consumePostgres(rule: RateLimitRule): Promise<boolean> {
  const supabase = createAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - rule.windowSeconds * 1000);

  const { data } = await supabase
    .from('rate_limits')
    .select('key, count, window_start')
    .eq('key', rule.key)
    .maybeSingle<{ key: string; count: number; window_start: string }>();

  if (!data || new Date(data.window_start) < windowStart) {
    await supabase
      .from('rate_limits')
      .upsert({ key: rule.key, count: 1, window_start: now.toISOString() }, { onConflict: 'key' });
    return true;
  }

  const next = data.count + 1;
  await supabase.from('rate_limits').update({ count: next }).eq('key', rule.key);
  return next <= rule.limit;
}

/**
 * §7: store a salted SHA-256 hash of the IP, never the raw address. The salt
 * comes from the environment so that the hashes are not reversible with a
 * rainbow table of the IPv4 space, which is small enough to enumerate.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? '';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? '0.0.0.0';
}
