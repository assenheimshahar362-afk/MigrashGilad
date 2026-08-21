import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { updateEventInput } from '@/lib/validation/admin';
import { ok, parseBody, revalidateSchedule } from '@/lib/api';
import {
  findSeriesConflict,
  followingOccurrences,
  planSeriesRemoval,
  planSeriesUpdate,
  seriesMove,
  type EventScope,
  type Neighbour,
} from '@/lib/event-series';
import { addLocalDays, localDate, weekdayOfLocalDate } from '@/lib/time';
import type { EventRow, RecurringRuleRow } from '@/lib/types';

/**
 * How far ahead a series edit or delete reaches. A weekly booking opened "for
 * two years" is ~104 rows; this is the ceiling on how many of them one action
 * can touch, so a mistyped edit cannot rewrite an unbounded slice of the
 * calendar in a single request.
 */
const SERIES_LIMIT = 200;

/** The other occurrences of the same repeating booking, from this one on. */
async function loadSeries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  anchor: EventRow,
): Promise<EventRow[]> {
  // Two shapes of "repeats" (§ lib/event-series.ts): a real series is fetched
  // by its rule id, a hand-entered one by title and type — the weekday and
  // wall-clock part of the match is decided in `followingOccurrences`, which
  // needs the local calendar and so cannot be a database filter.
  const query = supabase
    .from('events')
    .select('*')
    .eq('status', 'scheduled')
    .gte('starts_at', anchor.starts_at)
    .order('starts_at')
    .limit(SERIES_LIMIT);

  const { data } = anchor.recurring_id
    ? await query.eq('recurring_id', anchor.recurring_id)
    : await query.eq('title', anchor.title).eq('usage_type', anchor.usage_type);

  return followingOccurrences(anchor, (data ?? []) as EventRow[]);
}

/**
 * `PATCH /api/admin/events/[id]` (§8). Moving an event can conflict.
 *
 * FR-33a: `scope: 'following'` applies the same edit to this occurrence and
 * every later one of the same repeating booking — the answer to "this event
 * runs every Sunday and the hour has changed", which used to mean opening
 * fifty rows one at a time.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const { id } = await params;
    const input = await parseBody(request, updateEventInput);
    const scope: EventScope = input.scope ?? 'single';

    const supabase = await createClient();
    const { data: beforeRow } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
    if (!beforeRow) return errorResponse('ERR_NOT_FOUND');
    const before = beforeRow as EventRow;

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
    if (input.showNote !== undefined) patch.show_note = input.showNote;

    if (scope === 'single') {
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

      return ok({ event: data, updated: 1 });
    }

    // ---- scope: 'following' ------------------------------------------------
    const targets = await loadSeries(supabase, before);
    const movesInTime = input.start !== undefined || input.end !== undefined;
    const move = movesInTime
      ? seriesMove(before, input.start ?? before.starts_at, input.end ?? before.ends_at)
      : null;

    // What every occurrence will be set to, worked out in full before a single
    // row is written (§ lib/event-series.ts).
    const planned = planSeriesUpdate(before, targets, patch, move);

    // G4: no two live events of the same usage type may overlap. The write
    // below is a row at a time, so the conflict has to be found FIRST — the
    // alternative is a year of Sundays half moved, with the constraint
    // stopping the loop somewhere in the middle and no way back.
    const usageType = patch.usage_type ?? before.usage_type;
    const first = planned[0];
    const last = planned[planned.length - 1];
    if ((movesInTime || patch.usage_type !== undefined) && first && last) {
      // An overlap window, not a "starts inside" one: an event that began
      // before the first occurrence and runs into it overlaps just as much,
      // and asking only about start times would miss it.
      const { data: neighbours } = await supabase
        .from('events')
        .select('id,starts_at,ends_at')
        .eq('status', 'scheduled')
        .eq('usage_type', usageType)
        .lt('starts_at', last.endsAt)
        .gt('ends_at', first.startsAt);

      if (findSeriesConflict(planned, (neighbours ?? []) as Neighbour[])) {
        return errorResponse('ERR_SLOT_CONFLICT');
      }
    }

    let updated = 0;
    let anchorAfter: EventRow | null = null;

    for (const plan of planned) {
      const { data, error } = await supabase
        .from('events')
        .update(plan.patch)
        .eq('id', plan.id)
        .select('*')
        .maybeSingle();

      // One occurrence that will not move (something slipped into its new slot
      // between the check above and now) must not sink the rest: the ones
      // already written stay written, and the count returned is the truth.
      if (error) {
        if (plan.id === id) return errorResponse(codeFromDbError(error));
        continue;
      }

      updated += 1;
      if (plan.id === id) anchorAfter = data as EventRow;
    }

    // FR-34: the rule is the thing that generates NEXT year's occurrences, so
    // an edit that stops at the rows already materialised would quietly undo
    // itself every night. Only the fields a rule actually carries — it has no
    // description, phone or public-contact flag of its own.
    if (before.recurring_id) {
      const rulePatch: Partial<RecurringRuleRow> = {};
      if (patch.title !== undefined) rulePatch.title = patch.title;
      if (patch.usage_type !== undefined) rulePatch.usage_type = patch.usage_type;
      if (patch.contact_name !== undefined) rulePatch.contact_name = patch.contact_name;
      if (move) {
        rulePatch.start_time = move.startTime;
        rulePatch.end_time = move.endTime;
        if (move.dayDelta !== 0) {
          rulePatch.weekday = weekdayOfLocalDate(
            addLocalDays(localDate(before.starts_at), move.dayDelta),
          );
        }
      }

      if (Object.keys(rulePatch).length > 0) {
        await supabase.from('recurring_rules').update(rulePatch).eq('id', before.recurring_id);
      }
    }

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'event',
      entity_id: id,
      action: 'update_series',
      before,
      after: { ...(anchorAfter ?? {}), series_updated: updated },
    });

    revalidateSchedule();

    return ok({ event: anchorAfter, updated });
  });
}

/**
 * `DELETE /api/admin/events/[id]` (§8), optionally `?scope=following`.
 *
 * An event created from a request is CANCELLED rather than deleted, so the
 * `booking_requests.id -> events.request_id` link survives and the request's
 * own history (`/admin/requests`) keeps telling the truth (§5). A manually
 * created event with no request behind it is deleted outright — there is no
 * history to protect.
 *
 * FR-33a: with `scope=following` the same treatment reaches every later
 * occurrence of the repeating booking, and the RULE behind it is closed off at
 * the same date — without that last part the nightly `materialize_recurring`
 * would put every deleted occurrence straight back (§ init.sql).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const { id } = await params;
    const scope: EventScope =
      new URL(request.url).searchParams.get('scope') === 'following' ? 'following' : 'single';

    const supabase = await createClient();
    const { data: beforeRow } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
    if (!beforeRow) return errorResponse('ERR_NOT_FOUND');
    const before = beforeRow as EventRow;

    const targets = scope === 'following' ? await loadSeries(supabase, before) : [before];

    // Requests keep their event as a cancelled row; everything else goes.
    const { cancel, remove } = planSeriesRemoval(targets);

    if (cancel.length > 0) {
      const { error } = await supabase.from('events').update({ status: 'cancelled' }).in('id', cancel);
      if (error) return errorResponse(codeFromDbError(error));
    }

    if (remove.length > 0) {
      const { error } = await supabase.from('events').delete().in('id', remove);
      if (error) return errorResponse(codeFromDbError(error));
    }

    if (scope === 'following' && before.recurring_id) {
      const occurrenceDate = localDate(before.starts_at);
      const { data: rule } = await supabase
        .from('recurring_rules')
        .select('*')
        .eq('id', before.recurring_id)
        .maybeSingle();

      if (rule) {
        const typed = rule as RecurringRuleRow;
        // The rule is CLOSED, never deleted: `events.recurring_id ... on
        // delete cascade` (§6.2) means deleting it would take the series'
        // past occurrences with it, erasing weeks that already happened from
        // the public calendar and from anyone's memory of what was booked.
        // Closing the window is what stops `materialize_recurring` putting
        // the deleted occurrences straight back tonight.
        //
        // Deleting from the first occurrence onwards leaves nothing of the
        // series at all, so that one is also switched off — an empty rule
        // still listed as active is a row that claims to be generating
        // something and is not.
        const closesEntirely = typed.valid_from >= occurrenceDate;
        await supabase
          .from('recurring_rules')
          .update({
            valid_until: addLocalDays(occurrenceDate, -1),
            ...(closesEntirely ? { is_active: false } : {}),
          })
          .eq('id', typed.id);
      }
    }

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'event',
      entity_id: id,
      action: scope === 'following' ? 'delete_series' : before.request_id ? 'cancel' : 'delete',
      before,
      after: scope === 'following' ? { series_removed: targets.length } : null,
    });

    revalidateSchedule();

    return ok({ ok: true, removed: targets.length });
  });
}
