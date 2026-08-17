import type { Metadata } from 'next';
import { Mail, Phone, User } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn, formatIsraeliPhone, telLink } from '@/lib/utils';

export const metadata: Metadata = { title: t('a11y.title') };

/**
 * A11Y-9: a Hebrew accessibility statement with the name and contact details
 * of the accessibility coordinator — required by the Equal Rights for
 * Persons with Disabilities regulations, not optional. Used to be
 * `<section id="accessibility">` on the home page (§ one-page merge); split
 * back out to its own route, per product request, so it carries its own
 * <h1> and a stable, indexable URL.
 *
 * The coordinator named here is the real one (open decision #9, now closed).
 * The phone is stored in E.164 like every other number in the product, so it
 * dials correctly from abroad and is formatted for reading by the same helper
 * the trustee cards use — one spelling of a phone number across the site.
 */
const COORDINATOR = {
  name: 'שחר אסנהיים',
  phone: '+972533402610',
  email: 'assenheim.shahar@gmail.com',
};

/**
 * The regulations expect a statement to say WHEN it was written — an undated
 * one says nothing about the site as it stands today. Update this by hand
 * whenever the statement's substance changes; deriving it from the build date
 * would re-date the document on every unrelated deploy, which is worse than
 * useless as a record.
 */
const STATEMENT_UPDATED = '17 באוגוסט 2026';

/** How quickly an accessibility report is answered. A statement that invites
 *  reports without saying when they are handled leaves the visitor with no
 *  expectation to hold anyone to. */
const RESPONSE_DAYS = 5;

export default function AccessibilityPage() {
  return (
    <section className="section pb-28 lg:pb-16">
      <div className="shell-narrow">
        <h1 className="text-display">{t('a11y.title')}</h1>

        <p className="mt-2 text-sm text-(--ink-muted)">עודכן לאחרונה: {STATEMENT_UPDATED}</p>

        <div className="mt-6 space-y-3">
          <p>
            אתר מגרש גילעד הוא השירות המקוון של מגרש הכדורגל הקהילתי בקיבוץ גניגר. אנו רואים בנגישות
            חלק מהשירות עצמו, ופועלים כדי שכל אדם — לרבות אנשים עם מוגבלות — יוכל לצפות בלוח הזמנים
            ולהגיש בקשה לשימוש במגרש באופן עצמאי, נוח ושוויוני.
          </p>
          <p>
            האתר הונגש בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות),
            התשע״ג-2013, ולתקן הישראלי ת״י 5568 ברמת הנגשה AA, המבוסס על הנחיות{' '}
            <span dir="ltr">WCAG 2.0</span> של ארגון <span dir="ltr">W3C</span>.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-h2">מה הונגש באתר</h2>
          {/* Every line here is a claim someone may be held to, so each one is
              something the site actually does — see the audit that accompanied
              this page. Nothing aspirational, and nothing that was true of an
              earlier design: the previous version of this list promised arrow-
              key navigation inside the calendar grid, which this product has
              never had (the grid is read-only; § components/schedule/
              week-grid.tsx), and a promise like that is worse than no
              statement at all. */}
          <ul className="list-disc space-y-2 ps-5">
            <li>
              האתר כולו ניתן להפעלה במקלדת בלבד — קישורים, כפתורים, טפסים וחלונות — עם סימון פוקוס
              ברור וקישור ״דילוג לתוכן הראשי״ בתחילת כל עמוד.
            </li>
            <li>
              ללוח הזמנים קיימת חלופה טקסטואלית מלאה לקוראי מסך: רשימת אירועי השבוע לפי ימים, בסדר
              כרונולוגי, עם שמות הימים והשעות במלואם.
            </li>
            <li>{t('a11y.legend_colour_note')}</li>
            <li>
              ניגודיות הצבעים עומדת ביחס של 4.5:1 לפחות בטקסט רגיל ו-3:1 לפחות בטקסט גדול, לרבות
              הכיתוב שמעל תמונת הרקע בראש העמוד.
            </li>
            <li>אפשר להגדיל את התצוגה עד 400% בלי גלילה לרוחב ובלי אובדן תוכן או פעולה.</li>
            <li>
              בטפסים: לכל שדה תווית קבועה, הודעות השגיאה מוצמדות לשדה שאליו הן שייכות, מנוסחות
              בעברית פשוטה ומוכרזות אוטומטית לקוראי מסך.
            </li>
            <li>
              בחלונות הקופצים: הפוקוס נשמר בתוך החלון, מקש <span dir="ltr">Esc</span> סוגר אותו,
              והפוקוס חוזר לרכיב שממנו נפתח.
            </li>
            <li>האתר מכבד את העדפות מערכת ההפעלה לצמצום אנימציות ולהגברת ניגודיות.</li>
            <li>האתר כתוב עברית בכיוון ימין-לשמאל, ולכל עמוד כותרת ייחודית המזהה אותו.</li>
          </ul>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-h2">תפריט הנגישות</h2>
          <p>
            בכל עמוד באתר, בפינה התחתונה, נמצא כפתור ״תפריט נגישות״. הוא מאפשר להגדיל את הטקסט, להפעיל
            מצב ניגודיות גבוהה, להדגיש קישורים בקו תחתון ולצמצם אנימציות. הבחירה נשמרת במכשיר ונשארת
            בתוקף גם בביקורים הבאים.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-h2">מגבלות ידועות</h2>
          <ul className="list-disc space-y-2 ps-5">
            <li>
              תוכן שמוסיפים מנהלי המגרש — שמות אירועים ותיאורים — נכתב ידנית ועשוי במקרים נדירים
              להיות חסר או לא ברור. נתקן על פי דיווח.
            </li>
            <li>
              מפת Google המוטמעת בעמוד ״יצירת קשר״ היא רכיב של צד שלישי שאינו בשליטתנו. הכתובת
              המלאה מופיעה גם כטקסט לצד המפה, כך שאין תלות במפה עצמה.
            </li>
            <li>
              בתצוגת השבוע במסך טלפון, אירוע בודד צר מכדי לשמש מטרת לחיצה. לחיצה על היום פותחת את
              תצוגת היום, שבה כל אירוע מוצג ככרטיס מלא הניתן ללחיצה.
            </li>
          </ul>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-h2">נגישות המגרש עצמו</h2>
          <p>
            מגרש גילעד הוא מתקן פיזי בקיבוץ גניגר. לפרטים על נגישות הדרך אל המגרש, החניה והשירותים
            במקום — ולתיאום הגעה — אפשר לפנות לרכז הנגישות בפרטים שלמטה.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-h2">דיווח על בעיית נגישות</h2>
          <p>
            נתקלתם בעמוד, בפעולה או בתוכן שאינם נגישים? נשמח שתדווחו לנו. כדי שנוכל לטפל מהר, אפשר
            לציין את כתובת העמוד, מה ניסיתם לעשות, וכן את הדפדפן והמכשיר שבהם השתמשתם. נטפל בפנייה
            ונחזור אליכם בתוך {RESPONSE_DAYS} ימי עבודה.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-h2">רכז/ת הנגישות</h2>

          {/* Three facts about one person, so they sit inside ONE card with
              rules between them rather than as three loose lines — the same
              treatment the contact section on the home page gives address and
              hours. The label column has a fixed width, which is what puts the
              three values on a single edge; as bare `<dt>`s they each started
              wherever their own Hebrew word happened to end. */}
          <dl className="card divide-y divide-(--hairline) overflow-hidden">
            <CoordinatorRow icon={<User className="size-5" />} label="שם">
              {COORDINATOR.name}
            </CoordinatorRow>

            {/* Both are links: this is the page someone lands on precisely
                BECAUSE something on the site is hard for them to use, so the
                contact details should be one tap, not something to copy out by
                hand. The row's own height clears A11Y-1's 44px. */}
            <CoordinatorRow icon={<Phone className="size-5" />} label="טלפון">
              <a href={telLink(COORDINATOR.phone)} className={CONTACT_LINK}>
                <bdi dir="ltr">{formatIsraeliPhone(COORDINATOR.phone)}</bdi>
              </a>
            </CoordinatorRow>

            <CoordinatorRow icon={<Mail className="size-5" />} label="אימייל">
              {/* `break-all`: this address is longer than the value column on
                  a 320px phone, and an email is the one string where a break
                  mid-word is better than a row that pushes the page sideways. */}
              <a href={`mailto:${COORDINATOR.email}`} className={cn(CONTACT_LINK, 'break-all')}>
                <bdi dir="ltr">{COORDINATOR.email}</bdi>
              </a>
            </CoordinatorRow>
          </dl>
        </div>
      </div>
    </section>
  );
}

const CONTACT_LINK = cn(
  'font-semibold text-primary-700 underline underline-offset-4',
  'transition-colors duration-(--duration-tip) ease-(--ease-out-quiet) hover:text-primary-800',
);

/**
 * One labelled fact in the coordinator card. A fragment rather than a wrapper
 * element, so `<dt>` and `<dd>` stay direct children of a `<div>` inside the
 * `<dl>` — the icon lives inside the `<dt>` it decorates rather than as a
 * third sibling the list's content model has no place for.
 */
function CoordinatorRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <dt className="flex w-28 shrink-0 items-center gap-2.5 text-sm font-semibold text-(--ink-muted) sm:w-32">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-(--radius-input) bg-primary-50 text-primary-600"
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd className="min-w-0 flex-1 font-semibold">{children}</dd>
    </div>
  );
}
