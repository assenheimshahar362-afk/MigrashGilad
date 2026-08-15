import type { Metadata } from 'next';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('a11y.title') };

/**
 * A11Y-9: a Hebrew accessibility statement with the name and contact details
 * of the accessibility coordinator — required by the Equal Rights for
 * Persons with Disabilities regulations, not optional. Used to be
 * `<section id="accessibility">` on the home page (§ one-page merge); split
 * back out to its own route, per product request, so it carries its own
 * <h1> and a stable, indexable URL.
 *
 * [DECISION NEEDED — open decision #9] The named coordinator and their
 * contact details must come from the product owner before launch. The
 * placeholders below are marked so they cannot ship unnoticed.
 */
const COORDINATOR = {
  name: '[שם רכז/ת הנגישות]',
  phone: '[טלפון]',
  email: '[אימייל]',
};

export default function AccessibilityPage() {
  return (
    <section className="section pb-28 lg:pb-16">
      <div className="shell-narrow">
        <h1 className="text-display">{t('a11y.title')}</h1>

        <div className="mt-6 space-y-3">
          <p>
            אתר מגרש גילעד נבנה כדי לאפשר שימוש נוח ושוויוני לכלל הציבור, לרבות אנשים עם מוגבלות.
            האתר עומד בדרישות תקן ישראלי 5568 ברמת AA, בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות
            (התאמות נגישות לשירות).
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-h2">מה נגיש באתר</h2>
          <ul className="list-disc space-y-2 ps-5">
            <li>האתר כולו ניתן להפעלה מהמקלדת, כולל לוח הזמנים — מקשי החצים מדלגים בין ימים ושעות.</li>
            <li>
              ללוח הזמנים קיימת חלופה טקסטואלית מלאה לקוראי מסך: רשימת אירועי השבוע לפי ימים, לפי סדר
              כרונולוגי.
            </li>
            <li>{t('a11y.legend_colour_note')}</li>
            <li>ניגודיות הצבעים באתר עומדת ביחס של 4.5:1 לפחות בטקסט רגיל.</li>
            <li>כל שדות הטפסים מסומנים בתוויות, והודעות שגיאה מוצמדות לשדה שאליו הן שייכות.</li>
            <li>האתר מכבד את העדפות מערכת ההפעלה לצמצום אנימציות ולהגברת ניגודיות.</li>
          </ul>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-h2">מגבלות ידועות</h2>
          <p>
            תוכן שנוסף על ידי מנהלי המגרש עשוי במקרים נדירים לחסר תיאור חלופי. נשמח לקבל דיווח על כל
            תקלה כזו ולתקן אותה.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-h2">רכז/ת הנגישות</h2>
          <dl className="space-y-1">
            <div className="flex gap-2">
              <dt className="font-semibold">שם:</dt>
              <dd>{COORDINATOR.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold">טלפון:</dt>
              <dd>
                <bdi dir="ltr">{COORDINATOR.phone}</bdi>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold">אימייל:</dt>
              <dd>
                <bdi dir="ltr">{COORDINATOR.email}</bdi>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
