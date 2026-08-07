'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

/**
 * A11Y-6: every field has a real <label>; errors use aria-describedby and
 * aria-invalid. This component exists so that the wiring cannot be forgotten —
 * the ids are derived, not passed in.
 */
interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Shown once the field has validated, in place of the hint. */
  success?: string;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => React.ReactNode;
}

export function Field({
  id,
  label,
  error,
  hint,
  success,
  required,
  className,
  children,
}: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className={cn('flex flex-col gap-2', className)} data-state={error ? 'error' : undefined}>
      <LabelPrimitive.Root
        htmlFor={id}
        className="flex items-center gap-1 text-sm font-semibold text-(--ink)"
      >
        {label}
        {required ? (
          <span className="text-danger-ink" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="text-xs font-normal text-(--ink-faint)">
            ({t('common.optional')})
          </span>
        )}
      </LabelPrimitive.Root>

      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy || undefined,
      })}

      {hint && !error ? (
        <p id={hintId} className="text-xs text-(--ink-faint)">
          {hint}
        </p>
      ) : null}

      {/* The error rises as it appears. It is the one place in the form where
          something arrives unbidden, and the movement is what makes it noticed
          without needing to shout in colour. */}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="animate-rise-in flex items-start gap-1.5 text-sm font-semibold text-danger-ink"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {/* The success line is the counterpart: a field that has been validated
          says so, rather than leaving the visitor to infer it from silence. */}
      {success && !error ? (
        <p className="animate-rise-in flex items-start gap-1.5 text-sm font-semibold text-success-ink">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          {success}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The input rests slightly sunken and lifts to the raised surface on focus.
 * That inversion is the whole affordance: on a form of six fields the one you
 * are in should be the only one that looks like paper.
 *
 * `focus:` rather than `focus-visible:` for the ring here — unlike a button, a
 * text field focused by tap genuinely needs to show where the caret went.
 */
export const inputClass = cn(
  'min-h-12 w-full rounded-(--radius-input) border border-(--hairline)',
  'bg-(--surface-raised) px-4 text-base text-(--ink)',
  'placeholder:text-(--ink-faint)',
  'transition-[border-color,box-shadow,background-color] duration-(--duration-tip) ease-(--ease-out-quiet)',
  'hover:border-(--hairline-strong)',
  // Focus is a ring that grows from the border rather than a second outline
  // outside it, so the field appears to thicken in place instead of gaining a
  // halo that shifts the eye off the caret.
  'focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none',
  'aria-[invalid=true]:border-danger',
  'aria-[invalid=true]:focus:border-danger aria-[invalid=true]:focus:ring-danger/12',
  'disabled:cursor-not-allowed disabled:bg-(--surface-sunken) disabled:text-(--ink-faint)',
  'motion-reduce:transition-none',
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          inputClass,
          // Chrome renders the date/time picker button at the inline end, which
          // in RTL is the left — where it collides with nothing — but it needs
          // the cursor to read as pressable.
          '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
          '[&::-webkit-calendar-picker-indicator]:opacity-60',
          '[&::-webkit-calendar-picker-indicator]:hover:opacity-100',
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} rows={3} className={cn(inputClass, 'py-2', className)} {...props} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(inputClass, 'cursor-pointer', className)} {...props}>
      {children}
    </select>
  );
});
