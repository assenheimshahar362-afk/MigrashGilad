import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { REQUEST_STATUSES, type BookingRequestRow, type RequestStatus } from '@/lib/types';
import { RequestHistoryList } from '@/components/admin/request-history-list';

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

      <RequestHistoryList requests={requests} />
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
