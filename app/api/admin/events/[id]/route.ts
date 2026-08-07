import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { updateEventInput } from '@/lib/validation/admin';
import { ok, parseBody, revalidateSchedule } from '@/lib/api';
import type { EventRow } from '@/lib/types';

/** `PATCH /api/admin/events/[id]` (§8). Moving an event can conflict. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const { id } = await params;
    const input = await parseBody(request, updateEventInput);

    const supabase = await createClient();
    const { data: before } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
    if (!before) return errorResponse('ERR_NOT_FOUND');

    // Typed as the row's own Update shape, so a renamed column is a compile
    // error here rather than a silently ignored key at the database.
    const patch: Partial<EventRow> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.usageType !== undefined) patch.usage_type = input.usageType;
    if (input.start !== undefined) patch.starts_at = input.start;
    if (input.end !== undefined) patch.ends_at = input.end;
    if (input.contactName !== undefined) patch.contact_name = input.contactName ?? null;
    if (input.contactPhone !== undefined) patch.contact_phone = input.contactPhone ?? null;
    if (input.showContact !== undefined) patch.show_contact = input.showContact;

    const { data, error } = await supabase
      .from('events')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return errorResponse(codeFromDbError(error));

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'event',
      entity_id: id,
      action: 'update',
      before,
      after: data,
    });

    revalidateSchedule();

    return ok({ event: data });
  });
}

/**
 * `DELETE /api/admin/events/[id]` (§8).
 *
 * An event created from a request is CANCELLED rather than deleted, so the
 * `booking_requests.id -> events.request_id` link survives and the requester's
 * status page keeps telling the truth (§5). A manually created event with no
 * request behind it is deleted outright — there is no history to protect.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const { id } = await params;

    const supabase = await createClient();
    const { data: before } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
    if (!before) return errorResponse('ERR_NOT_FOUND');

    const row = before as { request_id: string | null };

    const { error } = row.request_id
      ? await supabase.from('events').update({ status: 'cancelled' }).eq('id', id)
      : await supabase.from('events').delete().eq('id', id);

    if (error) return errorResponse(codeFromDbError(error));

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'event',
      entity_id: id,
      action: row.request_id ? 'cancel' : 'delete',
      before,
    });

    revalidateSchedule();

    return ok({ ok: true });
  });
}
