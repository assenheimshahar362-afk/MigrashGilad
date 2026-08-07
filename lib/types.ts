/**
 * Domain types mirroring §6.2. These are hand-written rather than generated so
 * that the compiler is a check on the migration, not a copy of it — if the two
 * drift, the drift shows up as a type error in a query.
 *
 * Regenerating from a live database is still available:
 *   supabase gen types typescript --local > lib/database.types.ts
 */

export const USAGE_TYPES = [
  'community',
  'association',
  'special_event',
  'maintenance',
  'closed',
] as const;
export type UsageType = (typeof USAGE_TYPES)[number];

/** The subset a visitor may ask for (FR-11). */
export const REQUESTABLE_USAGE_TYPES = ['community', 'association', 'special_event'] as const;
export type RequestableUsageType = (typeof REQUESTABLE_USAGE_TYPES)[number];

export const REQUEST_STATUSES = [
  'pending',
  'approved',
  'approved_modified',
  'rejected',
  'cancelled',
  'expired',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type EventStatus = 'scheduled' | 'cancelled';
export type EventSource = 'manual' | 'request' | 'recurring';
export type AdminRole = 'admin' | 'super_admin';

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  usage_type: UsageType;
  starts_at: string;
  ends_at: string;
  status: EventStatus;
  source: EventSource;
  request_id: string | null;
  recurring_id: string | null;
  occurrence_date: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  show_contact: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * What the public schedule is allowed to expose. `contact_phone` is present
 * only when `show_contact` is true (§7 PII); the projection is applied on the
 * server so a phone number never reaches the browser in the first place.
 */
export type PublicEvent = {
  id: string;
  title: string;
  description: string | null;
  usageType: UsageType;
  startsAt: string;
  endsAt: string;
  source: EventSource;
  contactName: string | null;
  contactPhone: string | null;
}

export type ClosureRow = {
  id: string;
  reason: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  created_by: string | null;
  created_at: string;
}

export type PublicClosure = {
  id: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

export type TrusteeRow = {
  id: string;
  full_name: string;
  title: string | null;
  phone_e164: string;
  whatsapp_ok: boolean;
  photo_url: string | null;
  display_order: number;
  is_primary: boolean;
  is_available: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type RecurringRuleRow = {
  id: string;
  title: string;
  usage_type: UsageType;
  weekday: number;
  start_time: string;
  end_time: string;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  contact_name: string | null;
  created_by: string | null;
  created_at: string;
}

export type BookingRequestRow = {
  id: string;
  public_token: string;
  requester_name: string;
  requester_phone: string;
  usage_type: UsageType;
  requested_start: string;
  requested_end: string;
  participants: number | null;
  note: string | null;
  status: RequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  final_start: string | null;
  final_end: string | null;
  version: number;
  submitted_ip_hash: string | null;
  anonymised_at: string | null;
  created_at: string;
}

/**
 * The status page (§10.4) shows the requester their own data and nothing else.
 * The token is not echoed back and neither is the phone number — the person
 * holding the link already knows both, and a screenshot of this page should not
 * leak either.
 */
export type PublicRequestView = {
  status: RequestStatus;
  usageType: UsageType;
  requesterName: string;
  requestedStart: string;
  requestedEnd: string;
  finalStart: string | null;
  finalEnd: string | null;
  participants: number | null;
  note: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  cancellable: boolean;
}

/** `"0".."6"` = Sunday..Saturday. A `null` value means closed all day. */
export type OpeningHours = Record<string, [string, string] | null>;

export type SiteSettingsRow = {
  id: number;
  pitch_name: string;
  opening_hours: OpeningHours;
  min_lead_hours: number;
  max_horizon_days: number;
  max_duration_min: number;
  requests_open: boolean;
  requests_closed_msg: string | null;
  memorial_html: string | null;
  memorial_days: string[];
  updated_at: string;
  updated_by: string | null;
}

/** Settings safe to serve to anonymous clients. */
export type PublicSettings = {
  pitchName: string;
  openingHours: OpeningHours;
  minLeadHours: number;
  maxHorizonDays: number;
  maxDurationMin: number;
  requestsOpen: boolean;
  requestsClosedMsg: string | null;
  memorialDays: string[];
}

export type ManagerRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: AdminRole;
  notify_email: boolean;
  notify_push: boolean;
  phone_e164: string | null;
  created_at: string;
  revoked_at: string | null;
}

export type Manager = {
  id: string;
  email: string;
  fullName: string | null;
  role: AdminRole;
  revokedAt: string | null;
  lastSeen: string | null;
  hasSignedIn: boolean;
  isSelf: boolean;
}

/**
 * §2 access requests. A row here grants NOTHING: `is_admin()` still reads
 * `admin_allowlist`, and only `decide_access_request()` can write to it.
 */
export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export type AccessRequestRow = {
  id: string;
  email: string;
  full_name: string | null;
  /** Whatever Supabase Auth reported: `google`, `password`, … */
  provider: string;
  user_id: string | null;
  status: AccessRequestStatus;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decided_note: string | null;
}

export type AccessRequest = {
  id: string;
  email: string;
  fullName: string | null;
  provider: string;
  status: AccessRequestStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedNote: string | null;
  /** True when the address is already an active manager, decided or not. */
  alreadyAdmin: boolean;
}

export type AuditEntry = {
  id: number;
  actorId: string | null;
  actorLabel: string | null;
  entity: string;
  entityId: string | null;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

/** The signed-in manager, resolved server-side on every request (§2). */
export type AdminIdentity = {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: AdminRole;
  allowlistId: string;
}

export type ScheduleResponse = {
  events: PublicEvent[];
  closures: PublicClosure[];
  settings: PublicSettings;
}

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

export function toPublicEvent(row: EventRow): PublicEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    usageType: row.usage_type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    source: row.source,
    contactName: row.contact_name,
    contactPhone: row.show_contact ? row.contact_phone : null,
  };
}

export function toPublicClosure(row: ClosureRow): PublicClosure {
  return {
    id: row.id,
    reason: row.reason,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
  };
}

export function toPublicSettings(row: SiteSettingsRow): PublicSettings {
  return {
    pitchName: row.pitch_name,
    openingHours: row.opening_hours,
    minLeadHours: row.min_lead_hours,
    maxHorizonDays: row.max_horizon_days,
    maxDurationMin: row.max_duration_min,
    requestsOpen: row.requests_open,
    requestsClosedMsg: row.requests_closed_msg,
    memorialDays: row.memorial_days ?? [],
  };
}

export function toPublicRequestView(row: BookingRequestRow): PublicRequestView {
  return {
    status: row.status,
    usageType: row.usage_type,
    requesterName: row.requester_name,
    requestedStart: row.requested_start,
    requestedEnd: row.requested_end,
    finalStart: row.final_start,
    finalEnd: row.final_end,
    participants: row.participants,
    note: row.note,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    cancellable: row.status === 'pending',
  };
}

/** FR-4: an approved public request shows the requester's first name only. */
export function firstNameOnly(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export const DEFAULT_OPENING_HOURS: OpeningHours = {
  '0': ['06:00', '23:00'],
  '1': ['06:00', '23:00'],
  '2': ['06:00', '23:00'],
  '3': ['06:00', '23:00'],
  '4': ['06:00', '23:00'],
  '5': ['06:00', '23:00'],
  '6': ['06:00', '23:00'],
};

export const FALLBACK_SETTINGS: PublicSettings = {
  pitchName: 'מגרש גלעד',
  openingHours: DEFAULT_OPENING_HOURS,
  minLeadHours: 12,
  maxHorizonDays: 90,
  maxDurationMin: 180,
  requestsOpen: true,
  requestsClosedMsg: null,
  memorialDays: [],
};
