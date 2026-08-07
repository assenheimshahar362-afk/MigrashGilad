import { handleRoute, errorResponse } from '@/lib/errors';
import { getRequestByToken } from '@/lib/data';
import { buildIcs } from '@/lib/ics';
import { t } from '@/lib/i18n';
import { absoluteUrl } from '@/lib/utils';
import type { BookingRequestRow } from '@/lib/types';

/**
 * §10.4: an "add to calendar" .ics download, offered once a request is
 * approved. Not in the §8 table because it is a file download rather than a
 * JSON endpoint, but it lives on the same token-authorised path.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return handleRoute(async () => {
    const { token } = await params;
    const row = (await getRequestByToken(token)) as BookingRequestRow | null;

    if (!row) return errorResponse('ERR_NOT_FOUND');
    if (row.status !== 'approved' && row.status !== 'approved_modified') {
      return errorResponse('ERR_NOT_FOUND');
    }

    const start = new Date(row.final_start ?? row.requested_start);
    const end = new Date(row.final_end ?? row.requested_end);

    const ics = buildIcs({
      uid: `${row.id}@migrash-gilad`,
      start,
      end,
      title: t('app.name'),
      description: row.note ?? undefined,
      url: absoluteUrl(`/request/${token}`),
    });

    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="migrash-gilad.ics"',
        'Cache-Control': 'no-store',
      },
    });
  });
}
