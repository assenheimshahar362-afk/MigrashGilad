'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { USAGE_TYPES } from '@/lib/types';
import { usageTypeStyle } from '@/lib/usage-type';

/**
 * §10.1: a compact key of the usage types, collapsible.
 *
 * A11Y-3: each swatch carries its pattern, not only its fill — the legend is
 * where a visitor learns that stripes mean the association, so the pattern has
 * to be visible here or the grid becomes colour-only in practice.
 */
export function Legend({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('text-chalk-050', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="schedule-legend"
        className="tap-target flex w-full items-center justify-between gap-2 px-4 text-sm font-semibold"
      >
        {open ? t('schedule.legend_hide') : t('schedule.legend')}
        <ChevronDown
          className={cn('size-5 transition-transform duration-150', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      <ul
        id="schedule-legend"
        hidden={!open}
        className="flex flex-wrap gap-x-4 gap-y-2 px-4 pb-3 pt-1"
      >
        {USAGE_TYPES.map((type) => {
          const style = usageTypeStyle(type);
          return (
            <li key={type} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className={cn('inline-block size-4 shrink-0 rounded-sm', style.block, style.patternClass)}
              />
              {style.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
