'use client';

import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Every instance is icon-only, so `label` does double duty: the accessible
 * name (A11Y-2) AND, via `Tooltip`, the sighted-but-unsure answer to "what
 * does this button do" — the same text, on hover and on keyboard focus. A
 * text-labelled button already answers that question in its own label and
 * does not need one of these.
 */
export function IconButton({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'tap-target flex items-center justify-center rounded-(--radius-input) hover:bg-(--surface-sunken) disabled:opacity-40',
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}
