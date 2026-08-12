import { handleRoute, codeFromDbError, errorResponse, reportError } from '@/lib/errors';
import { requireSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { accessDecisionInput } from '@/lib/validation/auth';
import { ok, parseBody } from '@/lib/api';
import { emailAccessApproved } from '@/lib/notifications/email';
import type { AccessRequestRow } from '@/lib/types';

/**
 * `PATCH /api/admin/access/[id]` — SUPER ADMIN only.
 *
 * The handler carries no logic beyond validation: `decide_access_request()`
 * re-checks `is_super_admin()`, refuses an already-decided row, writes the
 * allowlist entry and files both audit rows in one transaction. Doing the
 * approval here in two statements would leave a window where the request is
 * approved but the allowlist is not written.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    await requireSuperAdmin();
    const { id } = await params;
    const input = await parseBody(request, accessDecisionInput);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('decide_access_request', {
      p_request_id: id,
      p_approve: input.approve,
      p_role: input.role,
      p_note: input.note ?? null,
    });

    if (error) return errorResponse(codeFromDbError(error));

    // The applicant learns they were approved by mail — never for a rejection
    // (§2). Awaited rather than fired-and-forgotten (unlike the fan-out on a
    // new booking request): this action happens a handful of times a month,
    // not per visitor, so there is no latency budget to protect here. A
    // failed send must not lose the approval itself — the allowlist write
    // already committed inside the RPC — so a send failure is reported and
    // swallowed, never surfaced as if the approval had failed.
    if (input.approve) {
      const approved = data as AccessRequestRow;
      try {
        await emailAccessApproved(approved, input.role);
      } catch (sendError) {
        reportError(sendError, { where: 'emailAccessApproved', requestId: approved.id });
      }
    }

    return ok({ request: data });
  });
}
