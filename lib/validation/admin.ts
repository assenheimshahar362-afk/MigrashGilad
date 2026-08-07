import { z } from 'zod';
import { USAGE_TYPES } from '@/lib/types';
import { israeliMobile } from '@/lib/validation/request';

const timeString = z.string().regex(/^\d{2}:\d{2}$/, 'ERR_VALIDATION');
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ERR_VALIDATION');

export const decisionInput = z
  .object({
    version: z.number().int().min(1),
    note: z.string().max(500).optional(),
  })
  .strict();

export const approveInput = z
  .object({
    version: z.number().int().min(1),
    start: z.iso.datetime({ offset: true }).optional(),
    end: z.iso.datetime({ offset: true }).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

/**
 * The event fields, before the cross-field refinement. Zod v4 refuses
 * `.partial()` on a schema that carries a refinement, so the base object is
 * kept separate and each variant adds the checks that apply to it: a create
 * always has both ends, a patch may move only one of them.
 */
const eventFields = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().max(1000).optional(),
    usageType: z.enum(USAGE_TYPES),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    contactName: z.string().max(80).optional(),
    contactPhone: israeliMobile.optional(),
    showContact: z.boolean().default(false),
  })
  .strict();

export const createEventInput = eventFields.refine(
  (v) => new Date(v.end) > new Date(v.start),
  'ERR_VALIDATION',
);

export const updateEventInput = eventFields
  .partial()
  .refine(
    // Only checkable when the patch supplies both; a one-sided move is
    // validated by the `event_time_order` constraint in the database.
    (v) => v.start === undefined || v.end === undefined || new Date(v.end) > new Date(v.start),
    'ERR_VALIDATION',
  );

const recurringFields = z
  .object({
    title: z.string().trim().min(1).max(120),
    usageType: z.enum(USAGE_TYPES),
    // 0 = Sunday .. 6 = Saturday. All seven are legal; Friday and Saturday are
    // ordinary operating days (§14, acceptance scenario 19).
    weekday: z.number().int().min(0).max(6),
    startTime: timeString,
    endTime: timeString,
    validFrom: dateString,
    validUntil: dateString.nullable().optional(),
    isActive: z.boolean().default(true),
    contactName: z.string().max(80).optional(),
  })
  .strict();

export const recurringInput = recurringFields.refine(
  (v) => v.endTime > v.startTime,
  'ERR_VALIDATION',
);

export const recurringPatchInput = recurringFields
  .partial()
  .refine(
    (v) => v.startTime === undefined || v.endTime === undefined || v.endTime > v.startTime,
    'ERR_VALIDATION',
  );

export const closureInput = z
  .object({
    reason: z.string().trim().min(1).max(200),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    allDay: z.boolean().default(false),
    cancelConflicts: z.boolean().default(false),
  })
  .strict()
  .refine((v) => new Date(v.end) > new Date(v.start), 'ERR_VALIDATION');

export const trusteeInput = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    title: z.string().max(80).optional(),
    phone: israeliMobile,
    whatsappOk: z.boolean().default(true),
    photoUrl: z.url().nullable().optional(),
    displayOrder: z.number().int().min(0).default(0),
    isPrimary: z.boolean().default(false),
    isAvailable: z.boolean().default(true),
    isArchived: z.boolean().default(false),
  })
  .strict();

export const trusteeUpdateInput = trusteeInput.partial();

/**
 * All seven keys are required (FR-37a). A missing key is a validation error,
 * not a default — the database refuses it too, and the two must agree.
 */
const openingHoursSchema = z
  .record(
    z.enum(['0', '1', '2', '3', '4', '5', '6']),
    z.tuple([timeString, timeString]).nullable(),
  )
  .refine(
    (v) => ['0', '1', '2', '3', '4', '5', '6'].every((d) => d in v),
    'ERR_OPENING_HOURS_INCOMPLETE',
  )
  .refine(
    (v) => Object.values(v).every((slot) => slot === null || slot[1] > slot[0]),
    'ERR_VALIDATION',
  );

export const settingsInput = z
  .object({
    pitchName: z.string().trim().min(1).max(80).optional(),
    openingHours: openingHoursSchema.optional(),
    minLeadHours: z.number().int().min(0).max(720).optional(),
    maxHorizonDays: z.number().int().min(1).max(730).optional(),
    maxDurationMin: z.number().int().min(15).max(360).optional(),
    requestsOpen: z.boolean().optional(),
    requestsClosedMsg: z.string().max(300).nullable().optional(),
    memorialHtml: z.string().max(50_000).nullable().optional(),
    memorialDays: z.array(dateString).max(50).optional(),
  })
  .strict();

export const addManagerInput = z
  .object({
    email: z.email(),
    fullName: z.string().max(80).optional(),
    role: z.enum(['admin', 'super_admin']).default('admin'),
  })
  .strict();

export const updateManagerInput = z
  .object({
    role: z.enum(['admin', 'super_admin']).optional(),
    revoke: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.role !== undefined || v.revoke !== undefined, 'ERR_VALIDATION');

export const pushSubscriptionInput = z
  .object({
    endpoint: z.url(),
    keys: z
      .object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      })
      .strict(),
    userAgent: z.string().max(500).optional(),
  })
  .strict();

export const auditQueryInput = z
  .object({
    entity: z.string().max(40).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
  })
  .strict();

export const maintenanceInput = z
  .object({
    action: z.enum(['materialize', 'expire', 'anonymise']),
    dryRun: z.boolean().default(false),
  })
  .strict();
