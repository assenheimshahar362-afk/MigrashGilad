import Link from 'next/link';
import { Facebook, Instagram, MessageCircle, Phone, MapPin, Clock } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * The dark footer. It is the only large dark surface left in the product, which
 * is what makes it read as the end of the page rather than as another band.
 *
 * A11Y-9 requires the accessibility statement to be reachable from every page,
 * which is why the legal column is never collapsed behind a disclosure.
 */
const NAV_COLUMNS = [
  {
    heading: t('footer.explore'),
    links: [
      { href: '/', label: t('nav.schedule') },
      { href: '/schedule/month', label: t('nav.month') },
      { href: '/request', label: t('nav.request') },
      { href: '/gallery', label: t('nav.gallery') },
    ],
  },
  {
    heading: t('footer.community'),
    links: [
      { href: '/about', label: t('nav.about') },
      { href: '/trustees', label: t('nav.trustees') },
      { href: '/faq', label: t('nav.faq') },
      { href: '/memorial', label: t('nav.memorial') },
    ],
  },
  {
    heading: t('footer.legal'),
    links: [
      { href: '/rules', label: t('nav.rules') },
      { href: '/accessibility', label: t('nav.accessibility') },
      { href: '/contact', label: t('nav.contact') },
    ],
  },
] as const;

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
      <div className="shell py-14 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:gap-8">
          {/* The identity column. */}
          <div>
            <p className="font-display text-h2 font-bold text-white">{pitchName}</p>
            <p className="mt-2 max-w-[36ch] text-sm">{t('footer.blurb')}</p>

            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary-300" aria-hidden />
                {t('contact.address_value')}
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-primary-300" aria-hidden />
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

          {NAV_COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="font-display text-sm font-semibold tracking-normal text-white">
                {column.heading}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        'inline-block rounded-sm',
                        'transition-colors duration-(--duration-tip) ease-(--ease-out-quiet)',
                        'hover:text-white focus-visible:outline-white',
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center">
          <p>
            © {year} {pitchName}. {t('footer.rights')}
          </p>
          <Link
            href="/memorial"
            className="text-memorial-chrome transition-colors duration-(--duration-tip) hover:text-white sm:ms-auto"
          >
            {t('memorial.title')}
          </Link>
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
        'transition-[background-color,box-shadow,transform] duration-(--duration-press)',
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
        'shadow-(--shadow-xs) transition-[background-color,border-color,box-shadow,transform]',
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
