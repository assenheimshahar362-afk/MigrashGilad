import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ok, revalidateSchedule } from '@/lib/api';

/**
 * Removing a closure does NOT restore the events it cancelled. Those rows are
 * `status = 'cancelled'` and the requesters have already been told; silently
 * reinstating them would put people back on a pitch they believe they lost.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const { id } = await params;

    const supabase = await createClient();
    const { data: before } = await supabase.from('closures').select('*').eq('id', id).maybeSingle();
    if (!before) return errorResponse('ERR_NOT_FOUND');

    const { error } = await supabase.from('closures').delete().eq('id', id);
    if (error) return errorResponse(codeFromDbError(error));

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'closure',
      entity_id: id,
      action: 'delete',
      before,
    });

    revalidateSchedule();

    return ok({ ok: true });
  });
}
