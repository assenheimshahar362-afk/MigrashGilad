import { cn } from '@/lib/utils';

/**
 * The pitch name, bracketed by the two red dots the crest itself uses — one
 * before "מגרש", one after "גלעד". The badge draws them as part of the
 * illustration; everywhere the name appears as plain text instead (the header,
 * the footer) it carries the same two dots, so the wordmark reads as the same
 * mark whether it is the raster crest or a line of type.
 *
 * The dots are `aria-hidden`: the accessible name comes from the text itself
 * (or a parent `aria-label`, as in the header link), never from decoration.
 */
export function PitchWordmark({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <Dot />
      <span className="min-w-0 truncate">{name}</span>
      <Dot />
    </span>
  );
}

function Dot() {
  return <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />;
}
