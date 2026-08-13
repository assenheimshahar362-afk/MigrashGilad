import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  formatDateShort,
  formatRelative,
  formatTimeRange,
  localDate,
} from '@/lib/time';
import { usageTypeLabel } from '@/lib/usage-type';
import { formatIsraeliPhone, telLink, cn } from '@/lib/utils';
import { REQUEST_STATUSES, type BookingRequestRow, type RequestStatus } from '@/lib/types';
import { StatusPill } from '@/components/ui/status-pill';
import { TimeRange, Ltr } from '@/components/ui/ltr';
import { DeleteRequestButton } from '@/components/admin/delete-request-button';

export const metadata: Metadata = { title: t('admin.nav.requests') };
export const dynamic = 'force-dynamic';

/**
 * §3 `/admin/requests` — request history with filters.
 *
 * §2: an admin may view the full request history INCLUDING PHONE NUMBERS. This
 * is the one screen where the numbers are listed in bulk, which is why the
 * filter is in the URL and the page is `no-store` — it should not be sitting in
 * a shared cache.
 */
export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const status = isStatus(params.status) ? params.status : null;

  const supabase = await createClient();
  let query = supabase
    .from('booking_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status) query = query.eq('status', status);

  const { data } = await query;
  const requests = (data ?? []) as BookingRequestRow[];

  return (
    <>
      <h1 className="mb-4 text-h2">{t('admin.nav.requests')}</h1>

      <nav aria-label={t('audit.filter.entity')} className="mb-5 flex flex-wrap gap-2">
        <FilterChip href="/admin/requests" active={!status}>
          {t('audit.filter.all')}
        </FilterChip>
        {REQUEST_STATUSES.map((value) => (
          <FilterChip
            key={value}
            href={`/admin/requests?status=${value}`}
            active={status === value}
          >
            {t(`status.${value}` as const)}
          </FilterChip>
        ))}
      </nav>

      {requests.length === 0 ? (
        <p className="empty-state">
          {t('admin.empty_generic')}
        </p>
      ) : (
        <ul className="divide-y divide-(--hairline) card">
          {requests.map((request) => (
            <li key={request.id} className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{request.requester_name}</span>
                <StatusPill status={request.status} className="text-xs" />
                <span className="ms-auto text-xs text-(--ink-muted)">
                  {formatRelative(request.created_at)}
                </span>
                <DeleteRequestButton id={request.id} name={request.requester_name} />
              </div>

              <p className="mt-1 text-xs text-(--ink-muted)">
                {formatDateShort(localDate(request.requested_start))} ·{' '}
                <TimeRange range={formatTimeRange(request.requested_start, request.requested_end)} />{' '}
                · {usageTypeLabel(request.usage_type)}
              </p>

              <p className="mt-1 text-xs">
                <a href={telLink(request.requester_phone)} className="underline underline-offset-4">
                  <Ltr>{formatIsraeliPhone(request.requester_phone)}</Ltr>
                </a>
              </p>

              {request.decision_note ? (
                <p className="mt-1 text-xs text-(--ink-muted)">
                  {t('status.admin_note')}: {request.decision_note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'tap-target flex items-center rounded-(--radius-chip) border px-3 text-sm font-semibold',
        // A solid accent fill carries white text — accent is a saturated red
        // now, and dark text on it fails contrast.
        active ? 'border-accent bg-accent text-white' : 'border-(--hairline)',
      )}
    >
      {children}
    </Link>
  );
}

function isStatus(value: string | undefined): value is RequestStatus {
  return Boolean(value) && (REQUEST_STATUSES as readonly string[]).includes(value!);
}
