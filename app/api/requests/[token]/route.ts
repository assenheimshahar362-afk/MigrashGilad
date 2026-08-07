import { NextResponse } from 'next/server';
import { handleRoute, errorResponse } from '@/lib/errors';
import { getRequestByToken } from '@/lib/data';
import { toPublicRequestView, type BookingRequestRow } from '@/lib/types';

/**
 * `GET /api/requests/[token]` (§8). Auth is the token itself.
 *
 * §7 token entropy: 24 random bytes, base64url — not guessable, not sequential.
 * The response is deliberately a projection (`PublicRequestView`), so the phone
 * number and the internal id never leave the server even though the row that
 * was read contains both.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return handleRoute(async () => {
    const { token } = await params;
    if (!token || token.length < 24) return errorResponse('ERR_NOT_FOUND');

    const row = (await getRequestByToken(token)) as BookingRequestRow | null;
    if (!row) return errorResponse('ERR_NOT_FOUND');

    return NextResponse.json(
      { request: toPublicRequestView(row) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  });
}
