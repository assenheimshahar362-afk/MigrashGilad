'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { USAGE_TYPES } from '@/lib/types';
import { eventStyle, usageTypeStyle } from '@/lib/usage-type';

/**
 * §10.1: a compact key of the usage types, collapsible.
 *
 * A11Y-3: each swatch carries its pattern, not only its fill — the legend is
 * where a visitor learns that stripes mean the association, so the pattern has
 * to be visible here or the grid becomes colour-only in practice.
 */
export function Legend({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const items = [
    ...USAGE_TYPES.map((type) => usageTypeStyle(type)),
    {
      ...eventStyle(t('schedule.booked_event'), 'community'),
      label: t('schedule.booked_event'),
    },
  ];

  return (
    <div className={cn('text-(--ink)', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="schedule-legend"
        className={cn(
          'tap-target flex w-full items-center justify-between gap-2 rounded-(--radius-input) px-4',
          'text-sm font-semibold text-(--ink-muted)',
          'transition-colors duration-(--duration-tip) ease-(--ease-out-quiet)',
          'hover:text-(--ink)',
        )}
      >
        {open ? t('schedule.legend_hide') : t('schedule.legend')}
        <ChevronDown
          className={cn(
            'size-5 transition-transform duration-(--duration-pop) ease-(--ease-out-quiet)',
            'motion-reduce:transition-none',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      <ul
        id="schedule-legend"
        hidden={!open}
        className="flex flex-wrap gap-2 px-4 pt-1 pb-3"
      >
        {items.map((style) => {
          return (
            <li
              key={style.label}
              className={cn(
                'inline-flex items-center gap-2 rounded-(--radius-chip) px-2.5 py-1 text-xs font-medium',
                style.chip,
              )}
            >
              <span
                aria-hidden
                className={cn('inline-block size-2.5 shrink-0 rounded-full', style.bar)}
              />
              {style.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
