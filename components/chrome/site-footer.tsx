import Link from 'next/link';
import Image from 'next/image';
import { Facebook, Instagram, MessageCircle, Phone, MapPin, Clock } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import logoMark from '@/public/images/logo-mark.webp';
import { PitchWordmark } from '@/components/chrome/pitch-wordmark';

/**
 * The dark footer. It is the only large dark surface left in the product, which
 * is what makes it read as the end of the page rather than as another band.
 *
 * It used to be three headed columns of three links each. Once the gallery and
 * the FAQ went, the headings were carrying more weight than the links under
 * them — a column titled "מידע" holding two entries is furniture. So the links
 * are now one wrapped row: nothing to scan past, nothing to name.
 *
 * A11Y-9 requires the accessibility statement to be reachable from every page,
 * which is why it is in that row and never behind a disclosure.
 */
const LINKS = [
  { href: '/#about', label: t('nav.about') },
  { href: '/#trustees', label: t('nav.trustees') },
  { href: '/#contact', label: t('nav.contact') },
  { href: '/rules', label: t('nav.rules') },
  { href: '/accessibility', label: t('nav.accessibility') },
] as const;

const footerNavItemClassName = cn(
  'flex min-h-11 items-center rounded-(--radius-input) px-3 text-sm',
  'transition-colors duration-(--duration-tip) ease-(--ease-out-quiet)',
  'hover:bg-white/8 hover:text-white focus-visible:outline-white',
);

/* Placeholder handles — swap for the real accounts. A social icon that leads
   nowhere is worse than no icon, so each is rendered only when its href is set
   to something other than the empty string. */
const SOCIALS = [
  { href: '', label: 'Facebook', Icon: Facebook },
  { href: '', label: 'Instagram', Icon: Instagram },
] as const;

export function SiteFooter({ pitchName }: { pitchName: string }) {
  const year = new Date().getFullYear();
  const socials = SOCIALS.filter((s) => s.href);

  return (
    <footer className="mt-auto bg-primary-900 text-white/70">
      <div className="shell py-12 sm:py-14">
        {/* The identity block is centred, because the two facts beneath it —
            where the pitch is and when it is open — are the reason most people
            reach the bottom of the page at all. */}
        <div className="flex flex-col items-center text-center">
          <Image
            src={logoMark}
            alt=""
            width={56}
            height={56}
            className="size-14 rounded-full shadow-[0_0_0_1px_rgb(255_255_255/0.15)]"
          />
          <PitchWordmark
            name={pitchName}
            className="mt-4 font-display text-h2 font-bold text-white"
          />
          <p className="mt-2 max-w-[42ch] text-sm">{t('footer.blurb')}</p>

          <ul className="mt-6 flex flex-col items-center gap-3 text-sm sm:flex-row sm:gap-6">
            <li className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-primary-300" aria-hidden />
              {t('contact.address_value')}
            </li>
            <li className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-primary-300" aria-hidden />
              {t('contact.hours_value')}
            </li>
          </ul>

          {socials.length > 0 ? (
            <ul className="mt-6 flex items-center gap-2">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={cn(
                      'press tap-target flex items-center justify-center rounded-(--radius-input)',
                      'border border-white/12 bg-white/6 text-white/80',
                      'transition-[background-color,border-color,color,transform]',
                      'duration-(--duration-press) ease-(--ease-out-quiet)',
                      'hover:border-white/30 hover:bg-white/14 hover:text-white',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* One rule above the links and one below, so the row reads as a band
            rather than as a paragraph that happens to be underlined. */}
        <nav
          aria-label={t('nav.primary')}
          className="mt-10 border-y border-white/10 py-2"
        >
          <ul className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={footerNavItemClassName}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-6 flex flex-col items-center gap-3 text-xs sm:flex-row sm:justify-center">
          <p dir="ltr">© {year} SA Software Solutions</p>
        </div>
      </div>
    </footer>
  );
}

/**
 * The single large WhatsApp action the brief asks for. It lives here as a
 * component rather than inline so the contact page and the trustees page use
 * exactly the same affordance.
 */
export function WhatsAppButton({
  phone,
  className,
}: {
  phone: string;
  className?: string;
}) {
  return (
    <a
      href={`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(t('trustees.whatsapp_prefill'))}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'press inline-flex min-h-14 items-center justify-center gap-3 rounded-(--radius-input)',
        'bg-[#25D366] px-7 text-base font-semibold text-[#0b3b21] shadow-(--shadow-md)',
        // `translate` alongside `transform`: `.press`'s active-scale is a
        // literal `transform`, but Tailwind v4 compiles the hover-lift
        // (`-translate-y-px`) below to the separate `translate` property —
        // without it here that lift snaps instead of easing in.
        'transition-[background-color,box-shadow,transform,translate] duration-(--duration-press)',
        'ease-(--ease-out-quiet) motion-safe:hover:-translate-y-px hover:bg-[#20bd5a]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      )}
    >
      <MessageCircle className="size-6" aria-hidden />
      {t('contact.whatsapp_cta')}
    </a>
  );
}

/** Used by the contact page for the phone counterpart. */
export function PhoneButton({ phone, className }: { phone: string; className?: string }) {
  return (
    <a
      href={`tel:${phone}`}
      className={cn(
        'press inline-flex min-h-14 items-center justify-center gap-3 rounded-(--radius-input)',
        'border border-(--hairline) bg-(--surface-raised) px-7 text-base font-semibold text-(--ink)',
        // `translate` alongside `transform`: see WhatsAppButton above.
        'shadow-(--shadow-xs) transition-[background-color,border-color,box-shadow,transform,translate]',
        'duration-(--duration-press) ease-(--ease-out-quiet)',
        'motion-safe:hover:-translate-y-px hover:border-(--hairline-strong) hover:bg-(--surface-hover)',
        className,
      )}
    >
      <Phone className="size-6" aria-hidden />
      {t('contact.call_cta')}
    </a>
  );
}
