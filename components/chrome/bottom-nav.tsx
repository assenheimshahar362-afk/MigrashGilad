'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FilePlus2, Users, Flower2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

/**
 * §3 global chrome: the bottom tab bar on mobile.
 *
 * §2 visitor rules: there is deliberately no "sign in" affordance here or
 * anywhere else in the public UI. The only route to /login is by typing it or
 * following an admin's bookmark.
 */
const TABS = [
  { href: '/', label: t('nav.schedule'), Icon: CalendarDays },
  { href: '/request', label: t('nav.request'), Icon: FilePlus2 },
  { href: '/trustees', label: t('nav.trustees'), Icon: Users },
  { href: '/memorial', label: t('nav.memorial'), Icon: Flower2 },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('nav.schedule')}
      className="sticky bottom-0 z-30 border-t border-[--hairline] bg-[--surface-raised]/95 backdrop-blur safe-bottom"
    >
      <ul className="mx-auto flex max-w-[720px]">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'tap-target flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold',
                  active ? 'text-[--ink]' : 'text-[--ink-muted]',
                )}
              >
                <Icon
                  className={cn('size-6', active && 'text-floodlight')}
                  aria-hidden
                  strokeWidth={active ? 2.4 : 1.8}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
