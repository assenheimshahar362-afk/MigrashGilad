'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { AdminRole } from '@/lib/types';

/**
 * FR-36b: an admin who opens a super-admin section gets a 403 page explaining
 * that it is limited to the super admin — not a redirect that looks like a bug.
 * The complement of that is here: the links are not shown to an admin at all,
 * so the 403 is a backstop for a bookmark, not the normal path.
 */
const LINKS = [
  { href: '/admin', label: t('admin.nav.dashboard'), exact: true, super: false },
  { href: '/admin/calendar', label: t('admin.nav.calendar'), super: false },
  { href: '/admin/recurring', label: t('admin.nav.recurring'), super: false },
  { href: '/admin/closures', label: t('admin.nav.closures'), super: false },
  { href: '/admin/trustees', label: t('admin.nav.trustees'), super: false },
  { href: '/admin/requests', label: t('admin.nav.requests'), super: false },
  { href: '/admin/managers', label: t('admin.nav.managers'), super: true },
  { href: '/admin/settings', label: t('admin.nav.settings'), super: true },
  { href: '/admin/audit', label: t('admin.nav.audit'), super: true },
] as const;

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const links = LINKS.filter((link) => !link.super || role === 'super_admin');

  return (
    <nav aria-label={t('admin.title')} className="border-t border-white/12">
      <ul className="mx-auto flex max-w-[960px] gap-1 overflow-x-auto px-2 py-2">
        {links.map((link) => {
          const active =
            'exact' in link && link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                /* The tab strip is navigated many times per admin session, so
                   the active state does not transition between tabs — only the
                   press scales. */
                className={cn(
                  'press flex h-11 items-center whitespace-nowrap rounded-(--radius-input) px-3',
                  'text-sm font-semibold',
                  'transition-[background-color,color,transform] duration-(--duration-press)',
                  'ease-(--ease-out-quiet)',
                  active
                    ? 'bg-white text-primary-800 shadow-(--shadow-xs)'
                    : 'text-white/70 hover:bg-white/12 hover:text-white',
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
