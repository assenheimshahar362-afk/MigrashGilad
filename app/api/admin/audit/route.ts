import { handleRoute, codeFromDbError, errorResponse } from '@/lib/errors';
import { requireSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { auditQueryInput } from '@/lib/validation/admin';
import { ok } from '@/lib/api';
import { toInstant, addLocalDays } from '@/lib/time';
import type { AuditEntry } from '@/lib/types';

/**
 * `GET /api/admin/audit` — SUPER ADMIN only (§8).
 *
 * §2: "every super-admin-only action is written to audit_log, including reading
 * nothing — the writes are what matter." Reading the log is therefore not
 * itself audited; that would be a loop with no reader.
 */
export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const parsed = auditQueryInput.safeParse({
      entity: searchParams.get('entity') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
    });

    if (!parsed.success) return errorResponse('ERR_VALIDATION');

    const supabase = await createClient();
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (parsed.data.entity) query = query.eq('entity', parsed.data.entity);
    if (parsed.data.from) query = query.gte('created_at', toInstant(parsed.data.from, '00:00').toISOString());
    if (parsed.data.to) {
      query = query.lt('created_at', toInstant(addLocalDays(parsed.data.to, 1), '00:00').toISOString());
    }

    const { data, error } = await query;
    if (error) return errorResponse(codeFromDbError(error));

    const entries: AuditEntry[] = (data ?? []).map((row) => ({
      id: row.id as number,
      actorId: row.actor_id as string | null,
      actorLabel: row.actor_label as string | null,
      entity: row.entity as string,
      entityId: row.entity_id as string | null,
      action: row.action as string,
      before: row.before,
      after: row.after,
      createdAt: row.created_at as string,
    }));

    return ok({ entries });
  });
}
