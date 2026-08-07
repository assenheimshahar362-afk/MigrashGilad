import { NextResponse, type NextRequest } from 'next/server';
import { handleRoute, errorResponse } from '@/lib/errors';
import { getSchedule, getSettings } from '@/lib/data';
import { scheduleRangeInput } from '@/lib/validation/request';
import type { ScheduleResponse } from '@/lib/types';

/**
 * `GET /api/schedule?from=&to=` (§8). Public, no auth.
 *
 * §12: the service worker caches this with StaleWhileRevalidate for 24 h, so
 * the schedule stays readable at the pitch where the signal is poor. That is
 * also why the response carries no user-specific data at all — it is safe to
 * share one cache entry between every visitor on a device.
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { searchParams } = new URL(request.url);
    const parsed = scheduleRangeInput.safeParse({
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
    });

    if (!parsed.success) return errorResponse('ERR_BAD_RANGE');

    const { from, to } = parsed.data;

    // A range wider than a year would let a single request pull the entire
    // table; the month view needs six weeks and the week view needs one.
    const spanDays = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (spanDays > 366) return errorResponse('ERR_BAD_RANGE');

    const [{ events, closures }, settings] = await Promise.all([
      getSchedule(from, to),
      getSettings(),
    ]);

    const body: ScheduleResponse = { events, closures, settings };

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  });
}
