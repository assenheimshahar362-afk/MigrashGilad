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
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-pitch-900/60 animate-fade-in" />
      <DialogPrimitive.Content
        dir="rtl"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 animate-sheet-up',
          'max-h-[85dvh] overflow-y-auto',
          'rounded-t-[--radius-card] border-t border-[--hairline]',
          'bg-[--surface-raised] p-5 safe-bottom',
          'sm:inset-x-auto sm:start-1/2 sm:bottom-auto sm:top-1/2',
          'sm:w-[min(32rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:rounded-[--radius-card] sm:border',
          className,
        )}
        {...props}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[--hairline] sm:hidden" aria-hidden />

        <div className="flex items-start justify-between gap-4">
          <DialogPrimitive.Title className="text-h3 font-bold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close
            className="tap-target -me-2 -mt-2 flex items-center justify-center rounded-[--radius-input] text-[--ink-muted] hover:bg-[--surface-sunken]"
            aria-label={t('common.close')}
          >
            <X className="size-5" aria-hidden />
          </DialogPrimitive.Close>
        </div>

        {description ? (
          <DialogPrimitive.Description className="mt-1 text-sm text-[--ink-muted]">
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
