import { cn } from '@/lib/utils';
import { t, type MessageKey } from '@/lib/i18n';
import type { RequestStatus } from '@/lib/types';

/**
 * §10.4 status pill. Colour is a reinforcement, never the carrier — the label
 * is always present, and the shapes differ by border weight so the six states
 * are still distinguishable in the monochrome memorial-day variant (FR-40).
 */
/* Soft tint + dark ink, not saturated fills. A saturated badge shouts at the
   same volume whatever it says; a tinted one lets "approved" sit quietly and
   "rejected" still register. The border style stays a per-state signal so the
   six remain distinguishable in the monochrome memorial variant. */
const STYLES: Record<RequestStatus, string> = {
  pending: 'bg-accent-100 text-accent-ink border border-dashed border-accent-600/50',
  approved: 'bg-success/12 text-success-ink border border-success/40',
  approved_modified: 'bg-success/10 text-success-ink border border-dotted border-success/60',
  rejected: 'bg-danger/10 text-danger-ink border border-danger/40',
  cancelled: 'bg-(--surface-sunken) text-(--ink-muted) border border-(--hairline)',
  expired: 'bg-(--surface-sunken) text-(--ink-faint) border border-dashed border-(--hairline-strong)',
};

/** The dot is a third, non-colour carrier of the state, and it is what lets the
 *  pill stay legible at a glance in the monochrome memorial variant. */
const DOTS: Record<RequestStatus, string> = {
  pending: 'bg-accent-600',
  approved: 'bg-success',
  approved_modified: 'bg-success',
  rejected: 'bg-danger',
  cancelled: 'bg-ink-2',
  expired: 'bg-ink-2',
};

export function StatusPill({ status, className }: { status: RequestStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-(--radius-chip) ps-2.5 pe-3 py-1',
        'text-sm font-semibold whitespace-nowrap',
        STYLES[status],
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOTS[status])} />
      {t(`status.${status}` as MessageKey)}
    </span>
  );
}
