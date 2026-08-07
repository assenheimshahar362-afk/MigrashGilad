import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * A11Y-1: every interactive element is at least 44×44px with a visible focus
 * ring. The size variants below all clear that, including `sm` — there is no
 * "compact" button in this product, because the whole thing is used one-handed
 * at a pitch gate.
 */
const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 rounded-[--radius-input] font-semibold',
    'transition-colors duration-150 ease-out',
    'disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-floodlight',
    '[&_svg]:size-5 [&_svg]:shrink-0',
  ),
  {
    variants: {
      variant: {
        primary: 'bg-floodlight text-pitch-900 hover:bg-floodlight/90',
        secondary:
          'bg-[--surface-raised] text-[--ink] border border-[--hairline] hover:bg-[--surface-sunken]',
        ghost: 'text-[--ink] hover:bg-[--surface-sunken]',
        onField:
          'bg-chalk-050/10 text-chalk-050 border border-chalk-050/30 hover:bg-chalk-050/20',
        danger: 'bg-signal-err text-chalk-050 hover:bg-signal-err/90',
        quiet: 'text-[--ink-muted] underline underline-offset-4 hover:text-[--ink]',
      },
      size: {
        default: 'min-h-11 px-5 text-base',
        sm: 'min-h-11 px-3 text-sm',
        lg: 'min-h-14 px-6 text-h3',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
});

export { buttonVariants };
