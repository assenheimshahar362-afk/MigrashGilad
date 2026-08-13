'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

/**
 * A label for an icon-only control, shown on hover AND on keyboard focus —
 * unlike a native `title`, which is mouse-only and therefore invisible to
 * anyone tabbing through the trustee list. `asChild` on the trigger means the
 * tooltip adds no extra DOM node around the button, so it never disturbs the
 * flex/gap layout it sits in.
 */
export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: string;
  children: React.ReactNode;
  /* Physical, not logical — Radix's Popper positions in physical space
     regardless of `dir`, so there is no `start`/`end` to offer here. */
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'animate-fade-in z-50 max-w-56 rounded-(--radius-input) bg-(--ink) px-2.5 py-1.5',
            'text-xs font-semibold text-white shadow-(--shadow-md)',
            'select-none',
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-(--ink)" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
