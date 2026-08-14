import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A11Y-1: every interactive element is at least 44×44px with a visible focus
 * ring. The size variants below all clear that, including `sm` — there is no
 * "compact" button in this product, because the whole thing is used one-handed
 * at a pitch gate.
 *
 * Motion: `translate`, `scale`, colour and shadow are transitioned BY NAME,
 * never with `all` — `all` would also animate the focus outline, which has to
 * appear on the frame the key is pressed. `translate`/`scale` BY NAME, not
 * `transform`: Tailwind v4 compiles the hover-lift and active-press utilities
 * below to those two standalone CSS properties, not to `transform` — listing
 * `transform` here would transition nothing they actually set.
 *
 * The interaction is a two-part gesture: a 1px lift on hover (fine pointers
 * only, via `motion-safe` + the media query Tailwind applies to `hover:`) and a
 * 0.97 press on active. The lift says "this is liftable"; the press is the only
 * feedback available during the network round-trip.
 */
const buttonVariants = cva(
  cn(
    'relative isolate inline-flex select-none items-center justify-center gap-2',
    // `max-w-full` + a wrapping label rather than `whitespace-nowrap`: the
    // long Hebrew calls to action here ("הגשת בקשה לשימוש במגרש") cannot fit
    // one line on a 320px phone, and a button that refuses to wrap does not
    // shrink — it widens the page and takes the whole layout with it. Short
    // labels are unaffected, since they never reach the wrap point.
    'max-w-full rounded-(--radius-input) text-center font-semibold text-balance',
    'transition-[translate,scale,background-color,border-color,color,box-shadow,opacity]',
    'duration-(--duration-press) ease-(--ease-out-quiet)',
    'active:scale-[0.97]',
    'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'motion-reduce:transition-none motion-reduce:active:scale-100',
    '[&_svg]:size-5 [&_svg]:shrink-0',
  ),
  {
    variants: {
      variant: {
        primary: cn(
          'bg-primary text-white shadow-(--shadow-sm)',
          'hover:bg-primary-600 hover:shadow-(--shadow-md)',
          'active:bg-primary-700',
        ),
        secondary: cn(
          'border border-(--hairline) bg-(--surface-raised) text-(--ink) shadow-(--shadow-xs)',
          'hover:border-(--hairline-strong) hover:bg-(--surface-hover) hover:shadow-(--shadow-sm)',
        ),
        /* The quiet third option: brand-tinted, no border, no shadow. */
        soft: 'bg-primary-50 text-primary-700 hover:bg-primary-100',
        ghost: 'text-(--ink) hover:bg-(--surface-sunken)',
        /* For buttons sitting on a photographic or coloured ground. */
        onField: cn(
          'border border-white/25 bg-white/12 text-white backdrop-blur-sm',
          'hover:border-white/40 hover:bg-white/20',
        ),
        danger: 'bg-danger text-white shadow-(--shadow-sm) hover:bg-danger/90',
        quiet: 'text-(--ink-muted) underline underline-offset-4 hover:text-(--ink)',
      },
      size: {
        default: 'min-h-11 px-5 text-base',
        sm: 'min-h-11 px-4 text-sm',
        lg: 'min-h-13 px-7 text-base sm:min-h-14 sm:text-h3',
        icon: 'size-11 p-0',
      },
      /** The hover lift. Off for `quiet` and `ghost`, which have no body to lift. */
      lift: {
        true: 'motion-safe:hover:-translate-y-px',
        false: '',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default', lift: true },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner and blocks input without collapsing the button's width. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, lift, asChild = false, loading = false, children, disabled, ...props },
  ref,
) {
  const lifts = lift ?? (variant !== 'quiet' && variant !== 'ghost');

  // `asChild` forwards to a Link, which cannot be disabled and has no loading
  // state — so the spinner is only ever rendered for a real <button>.
  if (asChild) {
    return (
      <Slot
        ref={ref}
        className={cn(buttonVariants({ variant, size, lift: lifts }), className)}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, lift: lifts }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* The label keeps its box and fades rather than being replaced, so the
          button does not resize on submit and shift the layout under the thumb
          that is still resting on the screen. */}
      <span
        className={cn(
          'inline-flex min-w-0 items-center justify-center gap-2',
          'transition-opacity duration-(--duration-tip)',
          loading && 'opacity-0',
        )}
      >
        {children}
      </span>

      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin" aria-hidden />
        </span>
      ) : null}
    </button>
  );
});

export { buttonVariants };
