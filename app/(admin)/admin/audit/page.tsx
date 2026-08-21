import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { getAdminIdentity } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatRelative } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Forbidden } from '@/components/admin/forbidden';

export const metadata: Metadata = { title: t('audit.title') };
export const dynamic = 'force-dynamic';

const ENTITIES = ['booking_request', 'event', 'closure', 'recurring_rule', 'trustee', 'admin_allowlist', 'site_settings'] as const;

/**
 * §10.9 `/admin/audit` — super admin only.
 *
 * FR-25: every state transition is recorded with actor, timestamp and
 * before/after. The before/after JSON is shown collapsed rather than rendered
 * as a diff: the audience is one person investigating one incident, and the
 * raw record is more trustworthy than a prettified summary of it.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const identity = await getAdminIdentity();
  if (!identity || identity.role !== 'super_admin') return <Forbidden />;

  const params = await searchParams;
  const entity = (ENTITIES as readonly string[]).includes(params.entity ?? '')
    ? params.entity!
    : null;

  const supabase = await createClient();
  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (entity) query = query.eq('entity', entity);

  const { data } = await query;
  const entries = data ?? [];

  return (
    <>
      <h1 className="mb-4 text-h2">{t('audit.title')}</h1>

      <nav aria-label={t('audit.filter.entity')} className="mb-5 flex flex-wrap gap-2">
        <Chip href="/admin/audit" active={!entity}>
          {t('audit.filter.all')}
        </Chip>
        {ENTITIES.map((value) => (
          <Chip key={value} href={`/admin/audit?entity=${value}`} active={entity === value}>
            {value}
          </Chip>
        ))}
      </nav>

      {entries.length === 0 ? (
        <p className="empty-state">
          {t('admin.empty_generic')}
        </p>
      ) : (
        <ul className="divide-y divide-(--hairline) card">
          {entries.map((entry) => (
            <li key={entry.id as number} className="p-3">
              <div className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-semibold">{entry.action as string}</span>
                <span className="text-(--ink-muted)">{entry.entity as string}</span>
                <span className="ms-auto text-xs text-(--ink-muted)">
                  {formatRelative(entry.created_at as string)}
                </span>
              </div>

              <p className="mt-0.5 text-xs text-(--ink-muted)">
                {(entry.actor_label as string | null) ?? (entry.actor_id as string | null) ?? '-'}
              </p>

              {entry.before || entry.after ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-(--ink-muted)">
                    {t('audit.column.entity')}
                  </summary>
                  <pre
                    dir="ltr"
                    className="mt-2 max-h-64 overflow-auto rounded-(--radius-input) bg-(--surface-sunken) p-2 text-[0.7rem]"
                  >
                    {JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Chip({
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
        'tap-target flex items-center rounded-(--radius-chip) border px-3 text-xs font-semibold',
        // A solid accent fill carries white text — accent is a saturated red
        // now, and dark text on it fails contrast.
        active ? 'border-accent bg-accent text-white' : 'border-(--hairline)',
      )}
    >
      {children}
    </Link>
  );
}
