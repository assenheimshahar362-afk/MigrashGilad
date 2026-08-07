import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { trusteeInput } from '@/lib/validation/admin';
import { ok, parseBody, revalidateTrustees } from '@/lib/api';

/**
 * FR-31: admins add, edit, reorder and ARCHIVE trustees. Archive, not hard
 * delete — a trustee who steps down was still the contact on last month's
 * events, and deleting them rewrites that.
 *
 * Not in the §8 endpoint table, which stops at the request and manager
 * surfaces; added here because FR-31 needs a write path and inventing one is
 * flagged rather than silent (§0.3).
 */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();
    const supabase = await createClient();
    const { data } = await supabase
      .from('trustees')
      .select('*')
      .order('is_archived')
      .order('display_order');
    return ok({ trustees: data ?? [] });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const input = await parseBody(request, trusteeInput);

    const supabase = await createClient();

    // FR-29: `is_primary` is the "on duty" slot and there is exactly one of it.
    if (input.isPrimary) {
      await supabase.from('trustees').update({ is_primary: false }).eq('is_primary', true);
    }

    const { data, error } = await supabase
      .from('trustees')
      .insert({
        full_name: input.fullName,
        title: input.title ?? null,
        phone_e164: input.phone,
        whatsapp_ok: input.whatsappOk,
        photo_url: input.photoUrl ?? null,
        display_order: input.displayOrder,
        is_primary: input.isPrimary,
        is_available: input.isAvailable,
        is_archived: input.isArchived,
      })
      .select('*')
      .single();

    if (error) return errorResponse(codeFromDbError(error));

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'trustee',
      entity_id: (data as { id: string }).id,
      action: 'create',
      after: data,
    });

    revalidateTrustees();

    return ok({ trustee: data }, 201);
  });
}
