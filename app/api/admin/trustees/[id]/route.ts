import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { trusteeUpdateInput } from '@/lib/validation/admin';
import { ok, parseBody, revalidateTrustees } from '@/lib/api';
import type { TrusteeRow } from '@/lib/types';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const { id } = await params;
    const input = await parseBody(request, trusteeUpdateInput);

    const supabase = await createClient();
    const { data: before } = await supabase.from('trustees').select('*').eq('id', id).maybeSingle();
    if (!before) return errorResponse('ERR_NOT_FOUND');

    if (input.isPrimary) {
      await supabase.from('trustees').update({ is_primary: false }).neq('id', id);
    }

    const patch: Partial<TrusteeRow> = {};
    if (input.fullName !== undefined) patch.full_name = input.fullName;
    if (input.title !== undefined) patch.title = input.title ?? null;
    if (input.phone !== undefined) patch.phone_e164 = input.phone;
    if (input.whatsappOk !== undefined) patch.whatsapp_ok = input.whatsappOk;
    if (input.photoUrl !== undefined) patch.photo_url = input.photoUrl ?? null;
    if (input.displayOrder !== undefined) patch.display_order = input.displayOrder;
    if (input.isPrimary !== undefined) patch.is_primary = input.isPrimary;
    if (input.isAvailable !== undefined) patch.is_available = input.isAvailable;
    if (input.isArchived !== undefined) patch.is_archived = input.isArchived;

    const { data, error } = await supabase
      .from('trustees')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return errorResponse(codeFromDbError(error));

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'trustee',
      entity_id: id,
      action: 'update',
      before,
      after: data,
    });

    revalidateTrustees();

    return ok({ trustee: data });
  });
}

/** FR-31 archive, not hard delete. There is deliberately no DELETE here. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const { id } = await params;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('trustees')
      .update({ is_archived: true, is_primary: false })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return errorResponse(codeFromDbError(error));

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'trustee',
      entity_id: id,
      action: 'archive',
      after: data,
    });

    revalidateTrustees();

    return ok({ trustee: data });
  });
}
