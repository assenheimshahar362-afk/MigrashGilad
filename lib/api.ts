import 'server-only';

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import type { ZodType } from 'zod';
import { AppError, errorResponse } from '@/lib/errors';
import { SCHEDULE_TAG, SETTINGS_TAG, TRUSTEES_TAG } from '@/lib/data';

/**
 * §7 input: every route handler validates with a Zod schema and rejects unknown
 * keys. This helper makes that the path of least resistance rather than a thing
 * to remember.
 */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new AppError('ERR_VALIDATION');
  return parsed.data;
}

export function ok<T>(body: T, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * NFR-3: the public schedule is statically rendered and revalidated on write.
 * Anything that changes what a visitor would see calls this.
 */
export function revalidateSchedule() {
  // 'max' profile: revalidate immediately on write, no implicit staleness
  // window. Matches pre-Next-16 revalidateTag(tag) behavior.
  revalidateTag(SCHEDULE_TAG, 'max');
}

export function revalidateSettings() {
  revalidateTag(SETTINGS_TAG, 'max');
  revalidateTag(SCHEDULE_TAG, 'max');
}

export function revalidateTrustees() {
  revalidateTag(TRUSTEES_TAG, 'max');
}

export { errorResponse };
