import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { decisionInput } from '@/lib/validation/admin';
import { ok, parseBody, revalidateSchedule } from '@/lib/api';

/**
 * `POST /api/admin/requests/[id]/reject` (§8).
 *
 * FR-22: the note is optional; the one-tap canned reasons are a UI affordance
 * (§10.7) that fills this field, not a separate concept in the data model.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    await requireAdmin();

    const { id } = await params;
    const input = await parseBody(request, decisionInput);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('reject_request', {
      p_request_id: id,
      p_version: input.version,
      p_note: input.note ?? null,
    });

    if (error) return errorResponse(codeFromDbError(error));

    revalidateSchedule();

    return ok({ status: (data as { status?: string } | null)?.status ?? 'rejected' });
  });
}
