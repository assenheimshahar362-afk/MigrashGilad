'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { apiFetch, errorText } from '@/lib/client-api';
import { IconButton } from '@/components/ui/icon-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/**
 * §10.9 pattern: housekeeping, not a decision — spam, duplicates, test
 * submissions. Available regardless of status, unlike approve/reject which
 * only apply to a `pending` request.
 */
export function DeleteRequestButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/requests/${id}`, { method: 'DELETE' });
      setConfirming(false);
      router.refresh();
    } catch (thrown) {
      // Dialog stays open on failure — closing it would lose the error, and
      // the object being deleted, in the same moment.
      setError(errorText(thrown));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <IconButton
        label={`${t('admin.delete_request')} — ${name}`}
        onClick={() => setConfirming(true)}
        className="text-danger-ink"
      >
        <Trash2 className="size-4" aria-hidden />
      </IconButton>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) setError(null);
        }}
        title={t('admin.delete_confirm', { name })}
        body={t('admin.delete_request_confirm_body')}
        confirmLabel={t('admin.delete_request')}
        pending={pending}
        onConfirm={remove}
      >
        {error ? (
          <p role="alert" className="text-sm font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
