import Link from 'next/link';
import { ArrowLeft, CalendarDays, ChevronDown } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * The landing hero.
 *
 * It is deliberately SHORT — `min-h` is capped well under a full viewport on
 * mobile, because the reason most people open this site is to find out who has
 * the pitch tonight, and a full-bleed splash would push that below the fold.
 * The scroll cue at the bottom exists for the same reason: it promises that the
 * schedule is immediately underneath.
 *
 * The background is `public/images/hero-pitch.svg`, a placeholder. Swap it for
 * a real photograph of the pitch; the overlay below is tuned to keep the
 * headline legible over a mid-tone image either way.
 */
export function Hero() {
  return (
    <section
      className={cn(
        'relative isolate flex flex-col justify-end overflow-hidden',
        // Capped rather than proportional on a phone: the schedule has to stay
        // within one thumb-flick of the top, because it is what most people
        // opened the site for. The `min()` is what keeps the floor from
        // exceeding the viewport on a landscape phone, where 30rem is taller
        // than the whole screen.
        'min-h-[min(30rem,88svh)] max-h-[38rem]',
        'sm:min-h-[min(34rem,88svh)] sm:max-h-none lg:min-h-[80svh]',
        // The header floats over this section, so the content needs clearance.
        'pt-24 pb-9 sm:pt-28 sm:pb-12 lg:pb-16',
        'short:pt-20 short:pb-6',
      )}
    >
      {/* The image. `background-image` rather than <Image> because it is purely
          decorative — it carries no information a screen reader needs, and this
          keeps it out of the accessibility tree entirely. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-primary-900 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/hero-pitch.svg')" }}
      />

      {/* Two overlays. The vertical gradient anchors the text at the bottom;
          the top scrim is what guarantees the header's white wordmark stays
          legible over WHATEVER photograph replaces the placeholder, including a
          bright one. Without it the chrome's legibility is a property of the
          image rather than of the design. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-t from-primary-900/95 via-primary-900/55 to-primary-900/40"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-32 bg-linear-to-b from-primary-900/85 to-transparent"
      />

      <div className="shell relative">
        <p className="animate-rise-in inline-flex items-center gap-2 rounded-(--radius-chip) border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          {t('hero.eyebrow')}
        </p>

        <h1 className="animate-rise-in mt-4 max-w-[16ch] font-display text-hero font-bold text-white [animation-delay:60ms]">
          {t('hero.title')}
        </h1>

        <p className="animate-rise-in mt-4 max-w-[46ch] text-base text-white/85 sm:text-lg [animation-delay:120ms]">
          {t('hero.subtitle')}
        </p>

        <div className="animate-rise-in mt-7 flex flex-wrap items-center gap-3 [animation-delay:180ms]">
          <Button asChild size="lg">
            <Link href="/request">
              {t('hero.cta_primary')}
              <ArrowLeft className="size-5" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="onField">
            <Link href="#schedule">
              <CalendarDays className="size-5" aria-hidden />
              {t('hero.cta_secondary')}
            </Link>
          </Button>
        </div>

        {/* Three facts, not a marketing grid. Each answers a question someone
            actually arrives with. */}
        {/* On a landscape phone the three facts are the first thing to go —
            the headline and the two actions are what the screen is for. */}
        <dl className="animate-rise-in mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-white/15 pt-5 [animation-delay:240ms] short:hidden">
          <Stat value={t('hero.stat_days_value')} label={t('hero.stat_days')} />
          <Stat value={t('hero.stat_free_value')} label={t('hero.stat_free')} />
          <Stat value={t('hero.stat_response_value')} label={t('hero.stat_response')} />
        </dl>
      </div>

      <a
        href="#schedule"
        className={cn(
          'absolute inset-x-0 bottom-4 mx-auto hidden w-fit items-center gap-1.5 rounded-(--radius-chip)',
          'bg-primary-800 px-3.5 py-2 text-xs font-medium text-white lg:flex',
          'border border-white/15 shadow-(--shadow-md)',
          'transition-colors duration-(--duration-tip) hover:bg-primary-700',
        )}
      >
        {t('hero.scroll')}
        <ChevronDown className="size-4" aria-hidden />
      </a>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="tnum block font-display text-h1 font-bold text-white">{value}</span>
        <span className="mt-0.5 block text-xs text-white/70">{label}</span>
      </dd>
    </div>
  );
}
