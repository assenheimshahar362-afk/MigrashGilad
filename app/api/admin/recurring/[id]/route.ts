import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { recurringPatchInput } from '@/lib/validation/admin';
import { ok, parseBody, revalidateSchedule } from '@/lib/api';
import type { RecurringRuleRow } from '@/lib/types';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const { id } = await params;
    const input = await parseBody(request, recurringPatchInput);

    const supabase = await createClient();
    const { data: before } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!before) return errorResponse('ERR_NOT_FOUND');

    const patch: Partial<RecurringRuleRow> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.usageType !== undefined) patch.usage_type = input.usageType;
    if (input.weekday !== undefined) patch.weekday = input.weekday;
    if (input.startTime !== undefined) patch.start_time = input.startTime;
    if (input.endTime !== undefined) patch.end_time = input.endTime;
    if (input.validFrom !== undefined) patch.valid_from = input.validFrom;
    if (input.validUntil !== undefined) patch.valid_until = input.validUntil ?? null;
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.contactName !== undefined) patch.contact_name = input.contactName ?? null;

    const { data, error } = await supabase
      .from('recurring_rules')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return errorResponse(codeFromDbError(error));

    // FR-34: occurrences are regenerated on rule change. Existing occurrences
    // for the old shape are NOT swept — an admin who narrows a rule is telling
    // us about the future, and silently deleting next week's already-published
    // slot would surprise everyone who read the schedule.
    await supabase.rpc('materialize_recurring', { p_horizon_days: 120 });

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'recurring_rule',
      entity_id: id,
      action: 'update',
      before,
      after: data,
    });

    revalidateSchedule();

    return ok({ rule: data });
  });
}

/**
 * Deleting a rule cascades to its generated occurrences through
 * `events.recurring_id ... on delete cascade` (§6.2), which is the intended
 * behaviour: an allocation that is withdrawn should not leave ghost blocks on
 * the public schedule.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const { id } = await params;

    const supabase = await createClient();
    const { data: before } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!before) return errorResponse('ERR_NOT_FOUND');

    const { error } = await supabase.from('recurring_rules').delete().eq('id', id);
    if (error) return errorResponse(codeFromDbError(error));

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'recurring_rule',
      entity_id: id,
      action: 'delete',
      before,
    });

    revalidateSchedule();

    return ok({ ok: true });
  });
}
