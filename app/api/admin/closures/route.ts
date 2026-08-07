import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { closureInput } from '@/lib/validation/admin';
import { ok, parseBody, revalidateSchedule } from '@/lib/api';

/**
 * `POST /api/admin/closures` (§8). FR-35.
 *
 * `cancelConflicts` is a caller decision, not a default. §14 is explicit that
 * there is no automatic Shabbat or chag closure — every closure, including a
 * holiday one, is entered by hand like any other, and cancelling the bookings
 * inside it is a separate, confirmed choice.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const input = await parseBody(request, closureInput);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_closure', {
      p_reason: input.reason,
      p_starts_at: input.start,
      p_ends_at: input.end,
      p_all_day: input.allDay,
      p_cancel_conflicts: input.cancelConflicts,
    });

    if (error) return errorResponse(codeFromDbError(error));

    revalidateSchedule();

    const result = data as { closure: unknown; cancelled: number };
    return ok({ closure: result.closure, cancelled: result.cancelled }, 201);
  });
}

/**
 * The confirmation dialog (§10.9) must NAME what it is about to cancel, so it
 * asks for the list before the admin commits to anything.
 */
export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    const supabase = await createClient();

    if (start && end) {
      const { data, error } = await supabase.rpc('preview_closure_conflicts', {
        p_starts_at: start,
        p_ends_at: end,
      });
      if (error) return errorResponse(codeFromDbError(error));
      return ok({ conflicts: data ?? [] });
    }

    const { data } = await supabase
      .from('closures')
      .select('*')
      .order('starts_at', { ascending: false })
      .limit(100);

    return ok({ closures: data ?? [] });
  });
}
