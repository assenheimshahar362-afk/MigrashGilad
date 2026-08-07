import { NextResponse, type NextRequest } from 'next/server';
import { handleRoute, errorResponse } from '@/lib/errors';
import { getSchedule, getSettings } from '@/lib/data';
import { availabilityInput } from '@/lib/validation/request';
import { conflictingEvents, isSlotClosed } from '@/lib/schedule';
import { localDate } from '@/lib/time';

/**
 * `GET /api/availability?start=&end=` (§8). Public, no auth.
 *
 * FR-13: the request form calls this before submit and WARNS rather than
 * blocks — an admin may still want to see a request for a taken slot, and the
 * visitor may know something the calendar does not.
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

    const [{ events, closures }, settings] = await Promise.all([
      getSchedule(date, localDate(end)),
      getSettings(),
    ]);

    const conflicts = conflictingEvents(events, start, end);
    const closed = isSlotClosed(closures, start, end);

    return NextResponse.json(
      {
        available: conflicts.length === 0 && !closed,
        closed,
        conflicts,
        // Echoed so the form can show the right message without a second call.
        requestsOpen: settings.requestsOpen,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  });
}
