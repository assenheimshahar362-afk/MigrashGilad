import { NextResponse, type NextRequest } from 'next/server';
import { handleRoute, errorResponse } from '@/lib/errors';
import { getSchedule } from '@/lib/data';
import { availabilityInput } from '@/lib/validation/request';
import { blockingEvents, conflictingEvents } from '@/lib/schedule';
import { localDate } from '@/lib/time';

/**
 * `GET /api/availability?start=&end=` (§8). Public, no auth.
 *
 * FR-13: the request form calls this before submit and WARNS rather than
 * blocks — an admin may still want to see a request for a taken slot, and the
 * visitor may know something the calendar does not.
 *
 * `blocked` is the one exception to that: association time is refused by
 * `POST /api/requests` outright, so the form is told about it here in order to
 * stop the visitor at the time step rather than after they have filled in
 * three screens. The route handler still re-checks — this answer can be stale
 * by the time they submit.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { searchParams } = new URL(request.url);
    const parsed = availabilityInput.safeParse({
      start: searchParams.get('start') ?? undefined,
      end: searchParams.get('end') ?? undefined,
    });

    if (!parsed.success) return errorResponse('ERR_BAD_RANGE');

    const start = new Date(parsed.data.start);
    const end = new Date(parsed.data.end);
    const date = localDate(start);

    const { events } = await getSchedule(date, localDate(end));
    const conflicts = conflictingEvents(events, start, end);
    const blocking = blockingEvents(events, start, end);
    const blockedReason = blocking.some((event) => event.usageType === 'association')
      ? 'association'
      : blocking.length > 0
        ? 'taken'
        : null;

    return NextResponse.json(
      { available: conflicts.length === 0, blocked: blocking.length > 0, blockedReason, conflicts },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  });
}
