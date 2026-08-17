import { NextResponse, type NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { AppError, handleRoute, errorResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRequestInput } from '@/lib/validation/request';
import { getSchedule, getSettings, SCHEDULE_TAG } from '@/lib/data';
import { assertRequestWindow, blockingAssociationEvents } from '@/lib/schedule';
import { localDate } from '@/lib/time';
import { verifyTurnstile } from '@/lib/turnstile';
import { clientIp, consume, hashIp, IP_RULE, PHONE_RULE } from '@/lib/rate-limit';
import { notifyAdminsOfNewRequest } from '@/lib/notifications/fan-out';
import type { BookingRequestRow } from '@/lib/types';

/**
 * `POST /api/requests` (§8) — the ONLY public write surface (§7). It used to
 * share that role with `POST /api/requests/[token]/cancel`, which is gone
 * now that a requester no longer tracks or cancels their own booking (§
 * request flow revision) — a trustee handles both by phone or WhatsApp.
 *
 * It stays a route handler rather than a server action specifically so it can
 * be rate-limited and monitored independently (§8 closing note).
 *
 * Order of checks matters. Turnstile and the rate limiter run before anything
 * touches the database, so a flood costs a token verification and a counter
 * increment, not a write.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const payload = await request.json().catch(() => null);
    const parsed = createRequestInput.safeParse(payload);

    if (!parsed.success) {
      // A phone that fails the format check gets the specific message; anything
      // else is a generic validation failure. The visitor should not have to
      // guess which of five fields is wrong when we know.
      const phoneIssue = parsed.error.issues.some(
        (issue) => issue.path[0] === 'requesterPhone' || issue.message === 'ERR_PHONE',
      );
      return errorResponse(phoneIssue ? 'ERR_PHONE' : 'ERR_VALIDATION');
    }

    const input = parsed.data;
    const ip = clientIp(request);
    const ipHash = hashIp(ip);

    // FR-15: bot protection, verified server-side.
    if (!(await verifyTurnstile(input.turnstileToken, ip))) {
      throw new AppError('ERR_BOT');
    }

    // FR-14: 3 per phone per 24 h, 10 per IP per hour.
    const [phoneOk, ipOk] = await Promise.all([
      consume(PHONE_RULE(input.requesterPhone)),
      consume(IP_RULE(ipHash)),
    ]);
    if (!phoneOk || !ipOk) throw new AppError('ERR_RATE_LIMITED');

    const settings = await getSettings();

    const start = new Date(input.start);
    const end = new Date(input.end);

    // FR-17, FR-18 and the opening-hours check. Throws the specific AppError.
    assertRequestWindow(settings, start, end);

    // Association time is not requestable, unless the association is already
    // sharing that slot with community time (§ `blockingAssociationEvents`).
    // Unlike an ordinary clash — which FR-13 only WARNS about, because an
    // admin may still want to see the request — this one is refused outright,
    // so it is checked here and not left to the form: the form is a courtesy,
    // this route is the rule.
    const { events } = await getSchedule(localDate(start), localDate(end));
    if (blockingAssociationEvents(events, start, end).length > 0) {
      throw new AppError('ERR_ASSOCIATION_SLOT');
    }

    // The write goes through the service role: `booking_requests` has no anon
    // policy at all (§6.4), and this is the proxy the spec calls for.
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('booking_requests')
      .insert({
        requester_name: input.requesterName,
        requester_phone: input.requesterPhone,
        usage_type: input.usageType,
        requested_start: start.toISOString(),
        requested_end: end.toISOString(),
        participants: input.participants ?? null,
        note: input.note ?? null,
        submitted_ip_hash: ipHash,
      })
      .select('*')
      .single<BookingRequestRow>();

    if (error || !data) throw error ?? new AppError('ERR_INTERNAL');

    // FR-19 / §9.1: fan-out to ALL admins, after the response is returned.
    notifyAdminsOfNewRequest(data);

    // The pending badge on the dashboard is derived from the schedule cache tag.
    revalidateTag(SCHEDULE_TAG, 'max');

    // No status link: the requester's only continuity is a trustee calling or
    // WhatsApping them back, using the number they just typed in — see
    // `components/admin/request-card.tsx`. `public_token` still exists on the
    // row (it mirrors the database) but nothing public reads it any more.
    return NextResponse.json({ id: data.id }, { status: 201 });
  });
}
