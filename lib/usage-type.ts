import { t, type MessageKey } from '@/lib/i18n';
import type { UsageType } from '@/lib/types';

/**
 * Usage-type mapping. Every type carries a colour, a pattern AND a text label —
 * never colour alone (A11Y-3, FR-3). The pattern classes live in
 * app/globals.css and are what keep the grid legible to someone who cannot
 * distinguish the fills, and in bright sunlight where the fills wash out.
 *
 * On a light calendar an event is a TINTED CARD, not a saturated block: a soft
 * wash of the hue, a solid rule on the leading edge, and the label set in the
 * dark end of the same hue. That is what Google Calendar and Notion Calendar
 * both do, and it is why a full week of events reads as calm rather than as a
 * bag of sweets. The leading edge is `border-inline-start`, so it lands on the
 * correct side under `dir="rtl"` without a second rule.
 */
export interface UsageTypeStyle {
  label: string;
  /** Block fill + border + text, for the schedule grid. */
  block: string;
  /** Small chip, for the legend and detail sheets. */
  chip: string;
  /** Solid colour, for month-view density bars. */
  bar: string;
  pattern: 'solid' | 'stripes' | 'dotted' | 'crosshatch' | 'hatch';
  patternClass: string;
}

const STYLES: Record<UsageType, Omit<UsageTypeStyle, 'label'>> = {
  community: {
    block: 'bg-primary-50 border-s-[3px] border-s-primary text-primary-800',
    chip: 'bg-primary-50 text-primary-800 border border-primary-200',
    bar: 'bg-primary',
    pattern: 'solid',
    patternClass: '',
  },
  association: {
    block: 'bg-warning/10 border-s-[3px] border-s-warning text-warning-ink',
    chip: 'bg-warning/10 text-warning-ink border border-warning/30',
    bar: 'bg-warning',
    pattern: 'stripes',
    patternClass: 'pattern-stripes',
  },
  special_event: {
    block: 'bg-accent-100 border-s-[3px] border-s-accent text-accent-ink',
    chip: 'bg-accent-100 text-accent-ink border border-accent',
    bar: 'bg-accent',
    pattern: 'dotted',
    patternClass: '',
  },
  maintenance: {
    block: 'bg-ink-2/10 border-s-[3px] border-s-ink-2 text-ink',
    chip: 'bg-ink-2/10 text-ink border border-ink-2/30',
    bar: 'bg-ink-2',
    pattern: 'crosshatch',
    patternClass: 'pattern-crosshatch',
  },
  closed: {
    block: 'bg-danger/8 border-s-[3px] border-s-danger text-danger-ink',
    chip: 'bg-danger/8 text-danger-ink border border-danger/40',
    bar: 'bg-danger',
    pattern: 'hatch',
    patternClass: 'pattern-hatch',
  },
};

export function usageTypeStyle(type: UsageType): UsageTypeStyle {
  return { label: usageTypeLabel(type), ...STYLES[type] };
}

export function usageTypeLabel(type: UsageType): string {
  return t(`usage.${type}` as MessageKey);
}
