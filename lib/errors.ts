import { NextResponse } from 'next/server';
import { t, isMessageKey } from '@/lib/i18n';

/**
 * §8: every API error is `{ error: { code, message } }` where `message` is
 * Hebrew user-facing text. Codes are the contract; messages are for people.
 */
export const ERROR_CODES = [
  'ERR_VALIDATION',
  'ERR_PHONE',
  'ERR_RATE_LIMITED',
  'ERR_LEAD_TIME',
  'ERR_PAST',
  'ERR_HORIZON',
  'ERR_DURATION',
  'ERR_END_BEFORE_START',
  'ERR_OUTSIDE_HOURS',
  'ERR_BOT',
  'ERR_BAD_RANGE',
  'ERR_NOT_FOUND',
  'ERR_NOT_CANCELLABLE',
  'ERR_ALREADY_DECIDED',
  'ERR_STALE',
  'ERR_SLOT_CONFLICT',
  'ERR_ASSOCIATION_SLOT',
  'ERR_SLOT_TAKEN',
  'ERR_CLOSED',
  'ERR_NOT_AUTHORIZED',
  'ERR_PENDING_APPROVAL',
  'ERR_BAD_CREDENTIALS',
  'ERR_SUPER_ONLY',
  'ERR_LAST_SUPER_ADMIN',
  'ERR_CANNOT_DEMOTE_SELF',
  'ERR_DUPLICATE',
  'ERR_FILE_TYPE',
  'ERR_FILE_TOO_LARGE',
  'ERR_INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS: Record<ErrorCode, number> = {
  ERR_VALIDATION: 400,
  ERR_PHONE: 400,
  ERR_RATE_LIMITED: 429,
  ERR_LEAD_TIME: 400,
  ERR_PAST: 400,
  ERR_HORIZON: 400,
  ERR_DURATION: 400,
  ERR_END_BEFORE_START: 400,
  ERR_OUTSIDE_HOURS: 400,
  ERR_BOT: 403,
  ERR_BAD_RANGE: 400,
  ERR_NOT_FOUND: 404,
  ERR_NOT_CANCELLABLE: 409,
  ERR_ALREADY_DECIDED: 409,
  ERR_STALE: 409,
  ERR_SLOT_CONFLICT: 409,
  ERR_ASSOCIATION_SLOT: 409,
  ERR_SLOT_TAKEN: 409,
  ERR_CLOSED: 409,
  ERR_NOT_AUTHORIZED: 401,
  ERR_PENDING_APPROVAL: 403,
  ERR_BAD_CREDENTIALS: 401,
  ERR_SUPER_ONLY: 403,
  ERR_LAST_SUPER_ADMIN: 409,
  ERR_CANNOT_DEMOTE_SELF: 409,
  ERR_DUPLICATE: 409,
  ERR_FILE_TYPE: 400,
  ERR_FILE_TOO_LARGE: 400,
  ERR_INTERNAL: 500,
};

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/** code → Hebrew message (§15.2 `lib/errors.ts`). */
export function errorMessage(code: ErrorCode, vars?: Record<string, string | number>): string {
  const key = `error.${code}`;
  return isMessageKey(key) ? t(key, vars) : t('error.generic');
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly vars?: Record<string, string | number>;

  constructor(code: ErrorCode, vars?: Record<string, string | number>) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.vars = vars;
  }
}

export function errorResponse(code: ErrorCode, vars?: Record<string, string | number>) {
  return NextResponse.json(
    { error: { code, message: errorMessage(code, vars) } },
    { status: STATUS[code] },
  );
}

/**
 * Postgres and PostgREST report our RPC `raise exception 'ERR_x'` messages in a
 * few different shapes depending on the client. This pulls the code out of any
 * of them, and maps the one error that arrives as a SQLSTATE rather than a
 * message: 23P01, the exclusion violation behind `events_no_overlap` (§6.3).
 */
export function codeFromDbError(error: unknown): ErrorCode {
  if (error && typeof error === 'object') {
    const e = error as { code?: string; message?: string; details?: string; hint?: string };
    if (e.code === '23P01') return 'ERR_SLOT_CONFLICT';
    const haystack = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`;
    const match = haystack.match(/ERR_[A-Z_]+/);
    if (match && isErrorCode(match[0])) return match[0];
  }
  if (error instanceof AppError) return error.code;

  // Nothing recognised it, so the caller is about to answer 500 with a generic
  // Hebrew message that says nothing about what actually broke. Logged HERE
  // rather than at each of the ~20 `errorResponse(codeFromDbError(error))` call
  // sites, because those all shared one blind spot: an unmapped Postgres
  // failure — a function that does not exist in the live database, a bad cast,
  // a missing grant — is precisely the class of error that leaves no trace in
  // the response, and it was being dropped on the floor at every one of them.
  reportError(error, { where: 'codeFromDbError' });
  return 'ERR_INTERNAL';
}

/**
 * Wrap a route handler body. Known AppErrors become their contract response;
 * anything else is logged and reduced to ERR_INTERNAL, so no stack trace ever
 * reaches the client (NFR-4).
 */
export async function handleRoute(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.vars);
    }
    // `codeFromDbError` reports anything it cannot map, so there is no second
    // `reportError` here — that would log every internal error twice.
    return errorResponse(codeFromDbError(error));
  }
}

/**
 * NFR-4: server-side errors go to Sentry with the request id. Sentry is wired
 * by installing `@sentry/nextjs` and setting SENTRY_DSN; until then this is the
 * single choke point every server error passes through, so swapping the body
 * for `Sentry.captureException` is a one-line change and nothing else moves.
 */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  console.error('[migrashginegar]', error, context ?? {});
}
