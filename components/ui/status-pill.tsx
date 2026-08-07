import { cn } from '@/lib/utils';
import { t, type MessageKey } from '@/lib/i18n';
import type { RequestStatus } from '@/lib/types';

/**
 * §10.4 status pill. Colour is a reinforcement, never the carrier — the label
 * is always present, and the shapes differ by border weight so the six states
 * are still distinguishable in the monochrome memorial-day variant (FR-40).
 */
const STYLES: Record<RequestStatus, string> = {
  pending: 'bg-floodlight/15 text-[--ink] border border-floodlight border-dashed',
  approved: 'bg-signal-ok/15 text-[--ink] border-2 border-signal-ok',
  approved_modified: 'bg-signal-ok/10 text-[--ink] border-2 border-dotted border-signal-ok',
  rejected: 'bg-signal-err/10 text-[--ink] border-2 border-signal-err',
  cancelled: 'bg-[--surface-sunken] text-[--ink-muted] border border-[--hairline]',
  expired: 'bg-[--surface-sunken] text-[--ink-muted] border border-dashed border-stone-500',
};

export function StatusPill({ status, className }: { status: RequestStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
        STYLES[status],
        className,
      )}
    >
      {t(`status.${status}` as MessageKey)}
    </span>
  );
}
