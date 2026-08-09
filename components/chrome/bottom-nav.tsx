'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FilePlus2, Users, Info, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { useRequestModal } from '@/components/request/request-modal-context';

/**
 * The mobile tab bar. Hidden from `lg` up, where the header navigation takes
 * over — the two are never on screen together.
 *
 * §2 visitor rules: there is deliberately no "sign in" affordance here or
 * anywhere else in the public UI. The only route to /login is by typing it or
 * following an admin's bookmark.
 *
 * Motion: the active indicator does NOT animate between tabs. This bar is
 * tapped dozens of times a day, and at that frequency any transition — however
 * short — is felt as the app lagging behind the finger. What does animate is
 * the press itself, which is feedback rather than decoration.
 */
const TABS = [
  { href: '/', label: t('nav.schedule'), Icon: CalendarDays },
  { href: '/#about', label: t('nav.about'), Icon: Info },
  { href: '/#trustees', label: t('nav.trustees'), Icon: Users },
  { href: '/#contact', label: t('nav.contact'), Icon: Phone },
] as const;

// The short label, not `nav.request`: five tabs on a 360px screen leave 72px
// each, and "הזמנת מגרש" wraps or truncates in every one of them. It opens
// the floating booking modal (request-modal-context.tsx) rather than linking
// anywhere, so it is rendered on its own below instead of living in TABS.
const REQUEST_TAB = { label: t('nav.request_short'), Icon: FilePlus2 };

const tabClassName = 'press tap-target relative flex flex-col items-center justify-center gap-1 py-2 text-[0.6875rem] font-medium';

export function BottomNav() {
  const pathname = usePathname();
  const { openRequestModal } = useRequestModal();

  return (
    <nav
      aria-label={t('nav.primary')}
      className={cn(
        'chrome-blur sticky bottom-0 z-30 border-t border-(--hairline) safe-bottom lg:hidden',
      )}
    >
      <ul className="mx-auto flex max-w-[560px]">
        <li className="flex-1">
          <button
            type="button"
            onClick={() => openRequestModal()}
            className={cn(tabClassName, 'w-full text-(--ink-muted)')}
          >
            <REQUEST_TAB.Icon className="relative size-[22px]" aria-hidden strokeWidth={1.75} />
            <span className="relative">{REQUEST_TAB.label}</span>
          </button>
        </li>

        {TABS.map(({ href, label, Icon }) => {
          // Only the calendar tab (a real route, `/`) can be "active"; the
          // rest are anchors on that same page and pathname cannot tell them
          // apart from one another.
          const active = href === '/' && pathname === '/';
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  tabClassName,
                  active ? 'text-primary-700 font-semibold' : 'text-(--ink-muted)',
                )}
              >
                {/* The lit pill behind the active icon. Brand green at 10% is
                    enough to read as "you are here" without competing with the
                    primary CTA that often sits directly above it. */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-1 h-8 w-14 rounded-(--radius-chip)',
                    active ? 'bg-primary-50' : 'bg-transparent',
                  )}
                />
                <Icon
                  className={cn('relative size-[22px]', active && 'text-primary-600')}
                  aria-hidden
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className="relative">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
