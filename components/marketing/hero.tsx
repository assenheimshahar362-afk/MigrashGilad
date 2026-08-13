import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { RequestCtaButton } from '@/components/request/request-cta-button';
import heroImage from '@/public/images/pitch-aerial.webp';

/**
 * The landing hero.
 *
 * It is deliberately SHORT — `min-h` is capped well under a full viewport on
 * mobile, because the reason most people open this site is to find out who has
 * the pitch tonight, and a full-bleed splash would push that below the fold.
 * The scroll cue at the bottom exists for the same reason: it promises that the
 * schedule is immediately underneath.
 *
 * The background is the aerial view of the pitch. It is served through
 * <Image> rather than as a CSS `background-image` for one reason that matters
 * on a phone: only the former is resized and re-encoded per device, so a 4G
 * visitor is not made to download a desktop-width file. The overlays below are
 * tuned to keep the headline legible over it — and over any photograph that
 * replaces it, including a bright one.
 *
 * This is the ONLY place the booking call to action lives. It used to be echoed
 * by a button docked over the schedule, which said the same thing twice and
 * covered the grid.
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
      {/* The image is decorative — everything it says is said again in the
          headline — so its alt is empty and it stays out of the accessibility
          tree. `priority` because it is the largest paint on the landing page:
          lazy-loading the thing the page is mostly made of only moves the
          moment the visitor waits for.

          The crop is per-breakpoint, not one compromise for both. A tall phone
          sees a narrow slice, so it is pushed away from the floodlight mast and
          onto the pitch and the goal; a wide screen already holds the whole
          frame and only needs the horizon lifted off the headline. */}
      <div aria-hidden className="absolute inset-0 -z-20 bg-primary-900">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          className="object-cover object-[62%_42%] lg:object-[50%_38%]"
        />
      </div>

      {/* Three overlays, each with one job.
          1. The vertical gradient anchors the text at the bottom. It is
             deliberately lighter from `lg` up, where the copy occupies one side
             of the frame rather than all of it — a full-strength wash there
             costs the photograph its green for no legibility gained.
          2. On a wide screen the copy sits at the inline start, which is the
             RIGHT under dir="rtl", so a horizontal scrim darkens that side only
             and leaves the pitch itself vivid.
          3. The top scrim guarantees the header's white wordmark stays legible
             over WHATEVER photograph is behind it, including a bright one.
             Without it the chrome's legibility is a property of the image
             rather than of the design. */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 -z-10 bg-linear-to-t',
          'from-primary-900/95 via-primary-900/55 to-primary-900/35',
          'lg:from-primary-900/88 lg:via-primary-900/35 lg:to-primary-900/12',
        )}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 hidden bg-linear-to-l from-primary-900/85 via-primary-900/30 to-transparent lg:block"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-32 bg-linear-to-b from-primary-900/85 to-transparent"
      />

      <div className="shell relative">
        <h1 className="animate-rise-in max-w-[16ch] font-sans text-hero font-bold text-white">
          {t('hero.title')}
        </h1>

        <p className="animate-rise-in mt-4 max-w-[60ch] whitespace-pre-line text-base text-white/85 sm:text-lg [animation-delay:120ms]">
          {t('hero.subtitle')}
        </p>

        <div className="animate-rise-in mt-7 flex flex-wrap items-center gap-3 [animation-delay:180ms]">
          <RequestCtaButton />
        </div>

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
