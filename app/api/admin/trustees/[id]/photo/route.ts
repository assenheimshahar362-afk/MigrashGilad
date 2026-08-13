import { handleRoute, codeFromDbError, errorResponse, AppError, reportError } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ok, revalidateTrustees } from '@/lib/api';

const BUCKET = 'trustee-photos';

// 4MB, not the 5MB a phone camera roll would suggest — Vercel's serverless
// functions cap the request body around 4.5MB, and this needs headroom under
// that ceiling rather than to sit right on it.
const MAX_BYTES = 4 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * One photo per trustee (FR-31 extension). Not in the §8 endpoint table for
 * the same reason `/api/admin/trustees` isn't — a write path FR-31 needs and
 * inventing one is flagged rather than silent (§0.3).
 *
 * The object path is just `${id}.${ext}`, no random suffix: `upsert: true`
 * replaces it in place on a re-upload rather than accumulating an orphan file
 * per edit. Since the path is stable, `?v=` in the stored URL is what busts
 * the browser/CDN cache after a replace.
 *
 * `upsert` only replaces the file at that SAME path, though — a jpg→png
 * re-upload lands at a different path and leaves the old jpg behind. The
 * cleanup below removes whichever of the other extensions might exist, so a
 * trustee never ends up with more than the one current file in the bucket.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const { id } = await params;

    const supabase = await createClient();
    const { data: before } = await supabase
      .from('trustees')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!before) return errorResponse('ERR_NOT_FOUND');

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) throw new AppError('ERR_VALIDATION');

    const ext = EXT_BY_TYPE[file.type];
    if (!ext) throw new AppError('ERR_FILE_TYPE');
    if (file.size > MAX_BYTES) throw new AppError('ERR_FILE_TOO_LARGE');

    const path = `${id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true });
    if (uploadError) {
      reportError(uploadError, { route: 'trustee-photo-upload', id });
      throw new AppError('ERR_INTERNAL');
    }

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const photoUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;

    const { data, error } = await supabase
      .from('trustees')
      .update({ photo_url: photoUrl })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return errorResponse(codeFromDbError(error));

    // Only runs once the new file is safely uploaded and the row points at
    // it — cleaning up first and having the upload fail would delete the
    // trustee's only photo instead of replacing it. Best-effort: a leftover
    // file from a previous extension is not worth failing the request over.
    const staleExts = Object.values(EXT_BY_TYPE).filter((candidate) => candidate !== ext);
    await supabase.storage
      .from(BUCKET)
      .remove(staleExts.map((candidate) => `${id}.${candidate}`));

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const identity = await requireAdmin();
    const { id } = await params;

    const supabase = await createClient();
    const { data: before } = await supabase
      .from('trustees')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!before) return errorResponse('ERR_NOT_FOUND');

    // The extension isn't known here, so try all three; removing a key that
    // isn't there is a no-op rather than an error.
    await supabase.storage
      .from(BUCKET)
      .remove(Object.values(EXT_BY_TYPE).map((ext) => `${id}.${ext}`));

    const { data, error } = await supabase
      .from('trustees')
      .update({ photo_url: null })
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
