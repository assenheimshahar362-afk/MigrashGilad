import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createEventInput } from '@/lib/validation/admin';
import { ok, parseBody, revalidateSchedule } from '@/lib/api';

/**
 * `POST /api/admin/events` (§8). FR-33: admins create events directly,
 * bypassing the request flow — this is how fixed community and association
 * hours are entered.
 *
 * The insert goes through the caller's session so `events_admin_write` judges
 * it, and the `events_no_overlap` exclusion constraint (§6.2) is what makes
 * double-booking impossible (G4). The 23P01 it raises becomes
 * ERR_SLOT_CONFLICT (scenario 5).
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const input = await parseBody(request, createEventInput);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('events')
      .insert({
        title: input.title,
        description: input.description ?? null,
        usage_type: input.usageType,
        starts_at: input.start,
        ends_at: input.end,
        source: 'manual',
        contact_name: input.contactName ?? null,
        contact_phone: input.contactPhone ?? null,
        show_contact: input.showContact,
        created_by: identity.userId,
      })
      .select('*')
      .single();

    if (error) return errorResponse(codeFromDbError(error));

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'event',
      entity_id: (data as { id: string }).id,
      action: 'create',
      after: data,
    });

    revalidateSchedule();

    return ok({ event: data }, 201);
  });
}
