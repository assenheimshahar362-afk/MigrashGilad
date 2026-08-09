'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

/**
 * The bottom sheet used for event detail (FR-4) and for confirmations. Radix
 * handles the focus trap, the escape key and the `aria-modal` semantics; what
 * is added here is the RTL-correct close affordance and the safe-area padding
 * that keeps the last button clear of the iOS home bar.
 *
 * Motion (§11.3):
 *   - Mobile: the sheet travels a full screen height, so it gets the iOS drawer
 *     curve and 420ms. `translateY(100%)` rather than a pixel value, because a
 *     percentage is relative to the element's own height and the sheet's height
 *     depends on its content.
 *   - Desktop: it is a centred modal, so it scales from 0.96 — never from 0,
 *     because nothing in the real world appears out of nothing — and keeps
 *     `transform-origin: center`. A modal is not anchored to a trigger, so
 *     origin-awareness (which popovers need) would be wrong here.
 *   - Exit runs at roughly half the enter duration. The user has already
 *     decided; the system should get out of the way.
 *
 * These are keyframes rather than transitions because Radix detects the end of
 * an exit animation to know when to unmount. A sheet is not re-triggered
 * rapidly enough for the interruptibility of transitions to matter.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-40 bg-ink/45 backdrop-blur-[3px]',
          'data-[state=open]:animate-[fade-in_220ms_var(--ease-out-quiet)_both]',
          'data-[state=closed]:animate-[fade-in_160ms_var(--ease-out-quiet)_reverse_both]',
        )}
      />
      <DialogPrimitive.Content
        dir="rtl"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50',
          'max-h-[85dvh] overflow-y-auto overscroll-contain',
          'rounded-t-(--radius-sheet) border-t border-(--hairline)',
          'bg-(--surface-raised) p-5 shadow-(--shadow-sheet) safe-bottom',
          'data-[state=open]:animate-[sheet-up_420ms_var(--ease-drawer)_both]',
          'data-[state=closed]:animate-[sheet-up_240ms_var(--ease-out-quiet)_reverse_both]',
          // Desktop: a centred dialog, not a drawer. `start-1/2` (logical,
          // app is RTL-only) resolves to `right:50%`, putting the dialog's
          // RIGHT edge at viewport centre — centring it from there needs a
          // +50% pull back toward the end, which is why `dialog-in` below
          // bakes in `translate3d(50%, -50%, 0)`.
          //
          // That centring transform is NOT also expressed as Tailwind
          // `translate-x-1/2`/`-translate-y-1/2` utility classes here — those
          // compile to the standalone CSS `translate` property (Tailwind v4),
          // which composes ON TOP OF `transform` rather than being folded
          // into it. Since Radix mounts Content fresh on every open (the
          // enter animation always runs, `fill: both` always ends up holding
          // its `to` state), adding both would translate the dialog TWICE —
          // exactly what previously sent it off-centre. The keyframe alone is
          // the single source of truth for this transform.
          'sm:inset-x-auto sm:start-1/2 sm:bottom-auto sm:top-1/2',
          'sm:w-[min(32rem,calc(100vw-2rem))]',
          'sm:rounded-(--radius-card) sm:border sm:shadow-(--shadow-lg)',
          'sm:data-[state=open]:animate-[dialog-in_220ms_var(--ease-out-quiet)_both]',
          'sm:data-[state=closed]:animate-[dialog-in_150ms_var(--ease-out-quiet)_reverse_both]',
          className,
        )}
        {...props}
      >
        {/* The grab handle. It is not draggable — it is the affordance that says
            "this came up from the bottom and goes back down", which is what
            makes swiping down to dismiss occur to someone at all. */}
        <div
          className="mx-auto mb-5 h-1.5 w-11 rounded-full bg-(--hairline-strong) sm:hidden"
          aria-hidden
        />

        <div className="flex items-start justify-between gap-4">
          <DialogPrimitive.Title className="text-h2 font-bold text-balance">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            className={cn(
              'press tap-target -me-2 -mt-2 flex items-center justify-center',
              'rounded-(--radius-input) text-(--ink-muted)',
              'transition-[background-color,color,transform] duration-(--duration-press) ease-(--ease-out-quiet)',
              'hover:bg-(--surface-sunken) hover:text-(--ink)',
            )}
            aria-label={t('common.close')}
          >
            <X className="size-5" aria-hidden />
          </DialogPrimitive.Close>
        </div>

        {description ? (
          <DialogPrimitive.Description className="mt-1 text-sm text-(--ink-muted)">
            {description}
          </DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}

        <div className="mt-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
