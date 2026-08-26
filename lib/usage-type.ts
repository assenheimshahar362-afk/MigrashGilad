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
    // Opaque `bg-warning-50`, not `bg-warning/10`: on the grid this card
    // sits over the hour-line rulings, and a translucent fill let them show
    // through as a stray line cutting across the card. The chip has no
    // ruling behind it, so it stays translucent there.
    block: 'bg-warning-50 border-s-[3px] border-s-warning text-warning-ink',
    chip: 'bg-warning/10 text-warning-ink border border-warning/30',
    bar: 'bg-warning',
    pattern: 'stripes',
    patternClass: 'pattern-stripes',
  },
};

/**
 * A real, named community booking should not look like the generic community
 * availability bands around it. Association events deliberately keep their
 * established yellow palette, regardless of title.
 */
const NAMED_COMMUNITY_EVENT_PALETTE = {
  block: 'bg-success-50 border-s-[3px] border-s-success text-success-ink',
  chip: 'bg-success-50 text-success-ink border border-success-200',
  bar: 'bg-success',
} satisfies Pick<UsageTypeStyle, 'block' | 'chip' | 'bar'>;

export function usageTypeStyle(type: UsageType): UsageTypeStyle {
  return { label: usageTypeLabel(type), ...STYLES[type] };
}

/**
 * Visual treatment for a schedule event. Association events always stay
 * yellow. A community event receives the green booking palette only when its
 * title is different from the generic "community time" label.
 */
export function eventStyle(title: string, type: UsageType): UsageTypeStyle {
  const style = usageTypeStyle(type);

  return type === 'association' || title.trim() === usageTypeLabel('community')
    ? style
    : { ...style, ...NAMED_COMMUNITY_EVENT_PALETTE };
}

export function usageTypeLabel(type: UsageType): string {
  return t(`usage.${type}` as MessageKey);
}
