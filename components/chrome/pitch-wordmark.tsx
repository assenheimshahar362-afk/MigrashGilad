import { cn } from '@/lib/utils';

/**
 * The pitch name, bracketed by the two red dots the crest itself uses — one
 * before "מגרש", one after "גילעד". The badge draws them as part of the
 * illustration; everywhere the name appears as plain text instead (the header,
 * the footer) it carries the same two dots, so the wordmark reads as the same
 * mark whether it is the raster crest or a line of type.
 *
 * The dots are `aria-hidden`: the accessible name comes from the text itself
 * (or a parent `aria-label`, as in the header link), never from decoration.
 */
export function PitchWordmark({ name, className }: { name: string; className?: string }) {
  return (
    // `max-w-full` as well as `min-w-0`: the two answer different questions.
    // `min-w-0` lets this shrink when it IS a flex item; `max-w-full` caps it
    // when it is not, so the truncate below still engages under a parent that
    // never constrained it — an inline wrapper, say (§ site-header.tsx). The
    // name is the one string on the page long enough to push the whole layout
    // sideways when the reader has scaled their text up.
    <span className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5', className)}>
      <Dot />
      <span className="min-w-0 truncate">{name}</span>
      <Dot />
    </span>
  );
}

function Dot() {
  return <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />;
}
