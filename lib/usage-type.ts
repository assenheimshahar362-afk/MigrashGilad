import { t, type MessageKey } from '@/lib/i18n';
import type { UsageType } from '@/lib/types';

/**
 * §11.1 usage-type mapping. Every type carries a colour, a pattern and a text
 * label — never colour alone (A11Y-3, FR-3). The pattern class is defined in
 * app/globals.css and is what makes the grid legible to someone who cannot
 * distinguish the fills, and in bright sunlight where the fills wash out.
 */
export interface UsageTypeStyle {
  label: string;
  /** Block fill + border, for the schedule grid (dark surface). */
  block: string;
  /** Small chip, for the legend and detail sheets (light surface). */
  chip: string;
  /** Solid colour, for month-view density bars. */
  bar: string;
  pattern: 'solid' | 'stripes' | 'dotted' | 'crosshatch' | 'hatch';
  patternClass: string;
}

const STYLES: Record<UsageType, Omit<UsageTypeStyle, 'label'>> = {
  community: {
    block: 'bg-pitch-700 border border-chalk-050/70 text-chalk-050',
    chip: 'bg-pitch-700 text-chalk-050 border border-pitch-900/20',
    bar: 'bg-pitch-700',
    pattern: 'solid',
    patternClass: '',
  },
  association: {
    block: 'bg-clay-500 border border-clay-500 text-chalk-050',
    chip: 'bg-clay-500 text-chalk-050 border border-clay-500',
    bar: 'bg-clay-500',
    pattern: 'stripes',
    patternClass: 'pattern-stripes',
  },
  special_event: {
    block: 'bg-floodlight border-2 border-dotted border-pitch-900 text-pitch-900',
    chip: 'bg-floodlight text-pitch-900 border-2 border-dotted border-pitch-900',
    bar: 'bg-floodlight',
    pattern: 'dotted',
    patternClass: '',
  },
  maintenance: {
    block: 'bg-stone-500 border border-stone-500 text-chalk-050',
    chip: 'bg-stone-500 text-chalk-050 border border-stone-500',
    bar: 'bg-stone-500',
    pattern: 'crosshatch',
    patternClass: 'pattern-crosshatch',
  },
  closed: {
    block: 'bg-transparent border border-signal-err text-signal-err',
    chip: 'bg-transparent text-signal-err border border-signal-err',
    bar: 'bg-signal-err',
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
