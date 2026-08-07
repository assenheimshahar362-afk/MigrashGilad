import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { getSettings } from '@/lib/data';
import { WEEKDAY_NAMES } from '@/lib/time';

export const metadata: Metadata = { title: t('rules.title') };
export const revalidate = 3600;

/**
 * §3 `/rules` — pitch rules and usage terms.
 *
 * The opening-hours table is generated from settings rather than written out,
 * so it cannot drift from what the booking rules actually enforce. All seven
 * days are listed, in the same style; Friday and Saturday are ordinary rows.
 */
export default async function RulesPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 pb-24">
      <h1 className="text-h1">{t('rules.title')}</h1>

      <section className="mt-8">
        <h2 className="text-h2">{t('settings.opening_hours')}</h2>
        <table className="mt-3 w-full border-collapse text-start">
          <caption className="sr-only">{t('settings.opening_hours')}</caption>
          <tbody>
            {WEEKDAY_NAMES.map((name, day) => {
              const hours = settings.openingHours[String(day)] ?? null;
              return (
                <tr key={name} className="border-b border-[--hairline]">
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
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-h2">כללי שימוש</h2>
        <ul className="list-disc space-y-2 ps-5">
          <li>המגרש פתוח לכל חברי הקהילה בשעות הפעילות המופיעות למעלה, בכל שבעת ימות השבוע.</li>
          <li>
            שימוש מאורגן מחייב בקשה מראש — לפחות {settings.minLeadHours} שעות לפני המועד, ועד{' '}
            {settings.maxHorizonDays} ימים קדימה.
          </li>
          <li>משך מקסימלי לבקשה: {settings.maxDurationMin} דקות.</li>
          <li>יש לפנות את המגרש בשעה שנקבעה, כדי לא לפגוע בקבוצה שאחריכם.</li>
          <li>אין להשאיר ציוד, אשפה או בקבוקים במגרש בסוף השימוש.</li>
          <li>נעלי פקקים מתכת אסורות לשימוש על הדשא.</li>
          <li>סגירות לתחזוקה, למזג אוויר או לימי זיכרון מתפרסמות בלוח הזמנים מראש.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-h2">שאלות</h2>
        <p className="mt-2">
          אפשר לפנות ל
          <Link href="/trustees" className="underline underline-offset-4">
            {t('trustees.title')}
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
