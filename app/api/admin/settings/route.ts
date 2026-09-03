import { requireAdmin } from '@/lib/auth';
import { ok, parseBody, revalidateSettings } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';
import { settingsInput } from '@/lib/validation/admin';
import { codeFromDbError, errorResponse, handleRoute } from '@/lib/errors';

export async function PATCH(request: Request) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const input = await parseBody(request, settingsInput);
    const supabase = await createClient();

    const { data: before } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('site_settings')
      .update({
        opening_time: input.openingTime,
        closing_time: input.closingTime,
        updated_by: identity.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .select('*')
      .single();

    if (error) return errorResponse(codeFromDbError(error));

    await supabase.from('audit_log').insert({
      actor_id: identity.userId,
      actor_label: identity.email,
      entity: 'site_settings',
      action: 'update',
      before,
      after: data,
    });

    revalidateSettings();
    return ok({ settings: data });
  });
}