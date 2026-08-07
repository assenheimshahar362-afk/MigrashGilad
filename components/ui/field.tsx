'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
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
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => React.ReactNode;
}

export function Field({ id, label, error, hint, required, className, children }: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <LabelPrimitive.Root htmlFor={id} className="text-sm font-semibold text-[--ink]">
        {label}
        {required ? (
          <span className="text-signal-err" aria-hidden="true">
            {' *'}
          </span>
        ) : (
          <span className="ms-1 text-xs font-normal text-[--ink-muted]">
            ({t('common.optional')})
          </span>
        )}
      </LabelPrimitive.Root>

      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy || undefined,
      })}

      {hint ? (
        <p id={hintId} className="text-xs text-[--ink-muted]">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-sm font-semibold text-signal-err">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass = cn(
  'min-h-11 w-full rounded-[--radius-input] border border-[--hairline]',
  'bg-[--surface-raised] px-3 text-base text-[--ink]',
  'placeholder:text-[--ink-muted]',
  'aria-[invalid=true]:border-signal-err aria-[invalid=true]:border-2',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-floodlight',
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClass, className)} {...props} />;
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
    <select ref={ref} className={cn(inputClass, className)} {...props}>
      {children}
    </select>
  );
});
