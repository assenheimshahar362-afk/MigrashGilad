import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * §11.4: phone numbers, times and dates are LTR runs inside RTL text. Without
 * isolation, `+972…` renders as `972+…` and `17:00–19:00` comes out reversed.
 *
 * `<bdi>` is the element the bidi algorithm was given for exactly this, and it
 * needs no CSS to work — which matters because this must still be right on the
 * server-rendered, JavaScript-disabled page (§10).
 */
export function Ltr({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children: React.ReactNode }) {
  return (
    <bdi dir="ltr" className={cn('ltr-run', className)} {...props}>
      {children}
    </bdi>
  );
}

/** A time range, already isolated. `17:00–19:00`, never reversed. */
export function TimeRange({ range, className }: { range: string; className?: string }) {
  return (
    <Ltr className={cn('tnum', className)}>
      <time>{range}</time>
    </Ltr>
  );
}
