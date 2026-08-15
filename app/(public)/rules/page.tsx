import Link from 'next/link';
import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { getSettings } from '@/lib/data';
import { WEEKDAY_NAMES } from '@/lib/time';

export const metadata: Metadata = { title: t('rules.title') };
export const revalidate = 300;

/**
 * §3 rules and usage terms. Used to be `<section id="rules">` on the home
 * page (§ one-page merge); split back out to its own route so it can carry
 * its own <h1> and be linked/bookmarked/indexed on its own, per product
 * request. The opening-hours table is generated from settings rather than
 * written out, so it cannot drift from what the booking rules actually
 * enforce. All seven days are listed, in the same style; Friday and Saturday
 * are ordinary rows.
 */
export default async function RulesPage() {
  const settings = await getSettings();

  return (
    <section className="section pb-28 lg:pb-16">
      <div className="shell-narrow">
        <h1 className="text-display">{t('rules.title')}</h1>

        <div className="mt-8">
          <h2 className="text-h2">{t('settings.opening_hours')}</h2>
          <table className="mt-3 w-full border-collapse text-start">
            <caption className="sr-only">{t('settings.opening_hours')}</caption>
            <tbody>
              {WEEKDAY_NAMES.map((name, day) => {
                const hours = settings.openingHours[String(day)] ?? null;
                return (
                  <tr key={name} className="border-b border-(--hairline)">
                    <th scope="row" className="py-2 text-start font-semibold">
                      {name}
                    </th>
                    <td className="py-2 text-end">
                      {hours ? (
                        <bdi dir="ltr" className="tnum">
                          {hours[0]}–{hours[1]}
                        </bdi>
                      ) : (
                        t('settings.day_closed')
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-h2">כללי שימוש</h2>
          <ul className="list-disc space-y-2 ps-5">
            <li>המגרש פתוח לכל חברי הקהילה בשעות הפעילות המופיעות למעלה, בכל שבעת ימות השבוע.</li>
            {/* The minimum-notice clause appears only when there IS one. At
                `minLeadHours: 0` this used to read "לפחות 0 שעות לפני המועד",
                which states a rule the site no longer enforces. */}
            <li>
              שימוש מאורגן מחייב בקשה מראש —{' '}
              {settings.minLeadHours > 0
                ? `לפחות ${settings.minLeadHours} שעות לפני המועד, ועד ${settings.maxHorizonDays} ימים קדימה.`
                : `אפשר להגיש גם למועד קרוב, ועד ${settings.maxHorizonDays} ימים קדימה.`}
            </li>
            <li>
              משך מקסימלי לבקשה: {settings.maxDurationMin} דקות
              {settings.maxDurationMin % 60 === 0
                ? ` (${settings.maxDurationMin / 60 === 2 ? 'שעתיים' : `${settings.maxDurationMin / 60} שעות`})`
                : ''}
              .
            </li>
            <li>יש לפנות את המגרש בשעה שנקבעה, כדי לא לפגוע בקבוצה שאחריכם.</li>
            <li>אין להשאיר ציוד, אשפה או בקבוקים במגרש בסוף השימוש.</li>
            <li>נעלי פקקים מתכת אסורות לשימוש על הדשא.</li>
            <li>סגירות לתחזוקה או למזג אוויר מתפרסמות בלוח הזמנים מראש.</li>
          </ul>
        </div>

        <div className="mt-8">
          <h2 className="text-h2">שאלות</h2>
          <p className="mt-2">
            אפשר לפנות ל
            <Link href="/#trustees" className="underline underline-offset-4">
              {t('trustees.title')}
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
