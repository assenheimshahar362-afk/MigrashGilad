import { z } from 'zod';
import { REQUESTABLE_USAGE_TYPES } from '@/lib/types';

/**
 * §8: a single source of truth for the request payload, shared between the
 * browser form and the route handler. `.strict()` everywhere — unknown keys are
 * rejected rather than ignored (§7 input).
 */
export const israeliMobile = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .refine((s) => /^(?:\+972|0)5\d{8}$/.test(s), 'ERR_PHONE')
  .transform((s) => (s.startsWith('0') ? `+972${s.slice(1)}` : s));

export const createRequestInput = z
  .object({
    requesterName: z.string().trim().min(2).max(80),
    requesterPhone: israeliMobile,
    usageType: z.enum(REQUESTABLE_USAGE_TYPES),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    participants: z.number().int().min(1).max(200).optional(),
    note: z.string().max(500).optional(),
    consent: z.literal(true),
    turnstileToken: z.string().min(1),
  })
  .strict();

/**
 * The shape the form holds before it is serialised for the API.
 *
 * `participants` stays a STRING here. An `<input type="number">` yields `''`
 * when cleared, and coercing that to a number gives 0, which then fails a
 * `min(1)` the visitor never triggered — so the conversion happens once, at
 * submit, where "empty" can mean "omitted".
 */
export const requestFormSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    usageType: z.enum(REQUESTABLE_USAGE_TYPES),
    participants: z
      .string()
      .refine((s) => s === '' || (/^\d+$/.test(s) && Number(s) >= 1 && Number(s) <= 200), 'ERR_VALIDATION'),
    note: z.string().max(500),
    requesterName: z.string().trim().min(2, 'ERR_VALIDATION').max(80),
    requesterPhone: z.string().refine((s) => /^(?:\+972|0)5\d{8}$/.test(s.replace(/[\s-]/g, '')), 'ERR_PHONE'),
    consent: z.literal(true),
  })
  // Its own code, not the generic one: WCAG 3.3.3 asks that an error say what
  // is actually wrong when we know, and "יש למלא את כל השדות הנדרשים" on a
  // field the visitor HAS filled in tells them to do something they already
  // did. The error lands on `endTime` because that is the field they will
  // change to fix it.
  .refine((v) => v.endTime > v.startTime, { path: ['endTime'], message: 'ERR_END_BEFORE_START' });

export type RequestFormValues = z.infer<typeof requestFormSchema>;

/**
 * The form schema plus the booking-length cap, which the base schema cannot
 * carry because it is a setting (`PublicSettings.maxDurationMin`), not a
 * constant. Built per-render from the same settings object the route handler
 * validates against, so the inline error and the server's answer can never
 * disagree about where the limit is.
 *
 * The error lands on `endTime` because that is the field the visitor changes to
 * fix it — the start time is the one they actually wanted.
 */
export function requestFormSchemaWithLimits(maxDurationMin: number) {
  return requestFormSchema.refine(
    (v) => minutesBetween(v.startTime, v.endTime) <= maxDurationMin,
    { path: ['endTime'], message: 'ERR_DURATION' },
  );
}

/** Both are `HH:MM` on the same local day — the schema already rejects a form
 *  where they are not, and a request may not cross midnight (§ schedule.ts). */
function minutesBetween(startTime: string, endTime: string): number {
  const [sh = 0, sm = 0] = startTime.split(':').map(Number);
  const [eh = 0, em = 0] = endTime.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export const scheduleRangeInput = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict()
  .refine((v) => v.to >= v.from, 'ERR_BAD_RANGE');

export const availabilityInput = z
  .object({
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((v) => new Date(v.end) > new Date(v.start), 'ERR_BAD_RANGE');

/**
 * Normalise a phone number outside a Zod pipeline — used by the rate limiter,
 * which keys on the E.164 form and must agree with what gets stored.
 */
export function normalisePhone(input: string): string | null {
  const cleaned = input.replace(/[\s-]/g, '');
  if (!/^(?:\+972|0)5\d{8}$/.test(cleaned)) return null;
  return cleaned.startsWith('0') ? `+972${cleaned.slice(1)}` : cleaned;
}
