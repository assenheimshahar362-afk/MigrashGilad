import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { maintenanceInput } from '@/lib/validation/admin';
import { ok, parseBody, revalidateSchedule } from '@/lib/api';

/**
 * FR-37b: maintenance actions available only to the super admin — re-run
 * recurring materialisation, force-expire stale requests, anonymise old
 * requests. Each SHOWS WHAT IT WILL AFFECT BEFORE RUNNING, which is what
 * `dryRun` is for: the same endpoint answers "how many?" and "do it".
 *
 * Not in the §8 endpoint table; added because FR-37b requires the behaviour and
 * inventing an endpoint is flagged rather than silent (§0.3).
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    await requireSuperAdmin();
    const input = await parseBody(request, maintenanceInput);

    const supabase = await createClient();

    if (input.dryRun) {
      const service = createAdminClient();

      switch (input.action) {
        case 'expire': {
          const { count } = await service
            .from('booking_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
            .lt('requested_start', new Date().toISOString());
          return ok({ affected: count ?? 0 });
        }
        case 'anonymise': {
          const cutoff = new Date();
          cutoff.setMonth(cutoff.getMonth() - 24);
          const { count } = await service
            .from('booking_requests')
            .select('id', { count: 'exact', head: true })
            .lt('created_at', cutoff.toISOString())
            .is('anonymised_at', null);
          return ok({ affected: count ?? 0 });
        }
        case 'materialize': {
          // Materialisation is idempotent, so the honest preview is the number
          // of active rules rather than a speculative occurrence count.
          const { count } = await service
            .from('recurring_rules')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true);
          return ok({ affected: count ?? 0 });
        }
      }
    }

    // Dispatched per branch rather than through a lookup table: each RPC has
    // its own argument type, and collapsing them loses that.
    const { data, error } =
      input.action === 'materialize'
        ? await supabase.rpc('materialize_recurring', { p_horizon_days: 120 })
        : input.action === 'expire'
          ? await supabase.rpc('expire_stale_requests')
          : await supabase.rpc('anonymise_old_requests', { p_months: 24 });

    if (error) return errorResponse(codeFromDbError(error));

    revalidateSchedule();

    return ok({ affected: (data as number) ?? 0 });
  });
}
