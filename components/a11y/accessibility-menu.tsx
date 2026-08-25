'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Accessibility,
  Contrast,
  Minus,
  Pause,
  Plus,
  RotateCcw,
  Underline,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

/**
 * Floating accessibility menu.
 *
 * Not a legal requirement on its own — Israeli law (תקנות נגישות השירות,
 * §35, and IS 5568) requires the SITE to conform to WCAG 2.0 AA and to
 * publish an accessibility statement (`/accessibility`); a floating widget is
 * common practice, not a substitute for either. This one is real rather than
 * decorative: every toggle here reuses treatments the app already ships for
 * the equivalent OS-level preference (`prefers-contrast: more`,
 * `prefers-reduced-motion: reduce` — see globals.css) so a visitor who
 * cannot or does not know how to set that at the OS level gets the same
 * result from here.
 *
 * A true modal (same `@radix-ui/react-dialog` primitive as `Sheet` — overlay,
 * focus trap, Escape, scroll lock, focus returned to the trigger on close),
 * just anchored beside the launcher button instead of centred/bottom-drawer:
 * `AnchoredContent` below is `Sheet`'s sibling, not a reuse of `SheetContent`,
 * because that one's positioning is centre/drawer-specific.
 *
 * Mounted once in the root layout, alongside the `beforeInteractive` script
 * there that applies a saved preference before first paint so returning
 * visitors never see a flash of the unadjusted page.
 */
const STORAGE_KEY = 'mg.a11y-prefs';

type FontScale = 'md' | 'lg' | 'xl';

interface A11yPrefs {
  fontScale: FontScale;
  contrast: boolean;
  underlineLinks: boolean;
  reduceMotion: boolean;
}

const DEFAULT_PREFS: A11yPrefs = {
  fontScale: 'md',
  contrast: false,
  underlineLinks: false,
  reduceMotion: false,
};

function applyPrefs(prefs: A11yPrefs) {
  const root = document.documentElement;
  root.dataset.a11yFontScale = prefs.fontScale;
  root.dataset.a11yContrast = String(prefs.contrast);
  root.dataset.a11yUnderlineLinks = String(prefs.underlineLinks);
  root.dataset.a11yMotion = prefs.reduceMotion ? 'reduce' : 'no-preference';
}

function loadPrefs(): A11yPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<A11yPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function AccessibilityMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_PREFS);

  const update = useCallback((next: Partial<A11yPrefs>) => {
    setPrefs((current) => {
      const merged = { ...current, ...next };
      applyPrefs(merged);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // Private browsing or a full quota: the toggle still works for this
        // page load, it just won't be remembered next visit.
      }
      return merged;
    });
  }, []);

  const reset = () => update(DEFAULT_PREFS);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        // The root-layout script already applies saved preferences before
        // paint. React only needs to read them when these controls are opened.
        if (next) setPrefs(loadPrefs());
        setOpen(next);
      }}
    >
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={t('a11y_menu.title')}
          // `end`, not a physical side: this corner is a fixed, direction-
          // independent UI convention (same reasoning as a chat launcher),
          // and under this app's RTL `end` already resolves to the visual
          // bottom-left where such widgets conventionally sit.
          className={cn(
            'fixed bottom-20 end-4 z-40 lg:bottom-6',
            'press tap-target flex size-12 items-center justify-center rounded-full',
            'bg-primary text-white shadow-(--shadow-lg)',
            'transition-transform duration-(--duration-press) ease-(--ease-out-quiet)',
            'hover:bg-primary-700',
          )}
        >
          <Accessibility className="size-6" aria-hidden />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-ink/45 backdrop-blur-[3px]',
            'data-[state=open]:animate-[fade-in_220ms_var(--ease-out-quiet)_both]',
            'data-[state=closed]:animate-[fade-in_160ms_var(--ease-out-quiet)_reverse_both]',
          )}
        />
        <DialogPrimitive.Content
          dir="rtl"
          // Anchored beside the launcher, not centred: same corner (`end-4`),
          // offset up by the button's own height plus a gap. Scales up from
          // that bottom edge — a popover grows from its trigger, a centred
          // modal does not (see components/ui/sheet.tsx's own note on this).
          className={cn(
            'fixed end-4 z-50 w-72 max-w-[calc(100vw-2rem)]',
            'bottom-[8.75rem] lg:bottom-[5.25rem]',
            // A popover anchored to a bottom corner grows UPWARDS, so on a
            // short viewport — a phone held in landscape is barely 375px tall
            // — its full natural height runs off the top of the screen and
            // takes the controls with it. Capped to whatever room is actually
            // left above the launcher, scrolling inside past that point.
            'max-h-[calc(100dvh-9.75rem)] overflow-y-auto overscroll-contain',
            'lg:max-h-[calc(100dvh-6.25rem)]',
            'origin-bottom rounded-(--radius-card) border border-(--hairline)',
            'bg-(--surface-raised) p-4 shadow-(--shadow-lg)',
            'data-[state=open]:animate-[anchored-menu-in_180ms_var(--ease-out-quiet)_both]',
            'data-[state=closed]:animate-[anchored-menu-in_120ms_var(--ease-out-quiet)_reverse_both]',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <DialogPrimitive.Title className="text-sm font-bold">
              {t('a11y_menu.title')}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label={t('common.close')}
              className="tap-target -me-2 flex items-center justify-center rounded-(--radius-input) text-(--ink-muted) hover:bg-(--surface-sunken)"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            {t('a11y_menu.title')}
          </DialogPrimitive.Description>

          <div className="mt-3 space-y-2.5">
            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold text-(--ink-muted)">
                {t('a11y_menu.text_size')}
              </legend>
              <div className="flex items-center gap-1.5">
                <StepperButton
                  label={t('a11y_menu.text_size_smaller')}
                  disabled={prefs.fontScale === 'md'}
                  onClick={() => update({ fontScale: prefs.fontScale === 'xl' ? 'lg' : 'md' })}
                >
                  <Minus className="size-4" aria-hidden />
                </StepperButton>
                <span className="tnum flex-1 text-center text-sm text-(--ink-muted)">
                  {{ md: '100%', lg: '112%', xl: '125%' }[prefs.fontScale]}
                </span>
                <StepperButton
                  label={t('a11y_menu.text_size_larger')}
                  disabled={prefs.fontScale === 'xl'}
                  onClick={() => update({ fontScale: prefs.fontScale === 'md' ? 'lg' : 'xl' })}
                >
                  <Plus className="size-4" aria-hidden />
                </StepperButton>
              </div>
            </fieldset>

            <MenuToggle
              label={t('a11y_menu.contrast')}
              icon={<Contrast className="size-4" aria-hidden />}
              pressed={prefs.contrast}
              onClick={() => update({ contrast: !prefs.contrast })}
            />
            <MenuToggle
              label={t('a11y_menu.underline_links')}
              icon={<Underline className="size-4" aria-hidden />}
              pressed={prefs.underlineLinks}
              onClick={() => update({ underlineLinks: !prefs.underlineLinks })}
            />
            <MenuToggle
              label={t('a11y_menu.reduce_motion')}
              icon={<Pause className="size-4" aria-hidden />}
              pressed={prefs.reduceMotion}
              onClick={() => update({ reduceMotion: !prefs.reduceMotion })}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-(--hairline) pt-3">
            <button
              type="button"
              onClick={reset}
              className="press-sm flex items-center gap-1.5 rounded-(--radius-input) text-sm font-semibold text-(--ink-muted) hover:text-(--ink)"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t('a11y_menu.reset')}
            </button>
            <Link
              href="/accessibility"
              className="text-sm font-semibold text-primary-600 underline underline-offset-4 hover:text-primary-700"
            >
              {t('a11y_menu.statement_link')}
            </Link>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function MenuToggle({
  label,
  icon,
  pressed,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-(--radius-input) border px-3 py-2 text-sm font-medium',
        'transition-colors duration-(--duration-tip) ease-(--ease-out-quiet)',
        pressed
          ? 'border-primary/40 bg-primary-50 text-primary-800'
          : 'border-(--hairline) bg-(--surface-raised) text-(--ink) hover:bg-(--surface-hover)',
      )}
    >
      {icon}
      {label}
      <span
        aria-hidden
        className={cn(
          'ms-auto inline-block size-2 rounded-full',
          pressed ? 'bg-primary' : 'bg-(--hairline-strong)',
        )}
      />
    </button>
  );
}

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'tap-target flex items-center justify-center rounded-(--radius-input) border',
        'border-(--hairline) bg-(--surface-raised) text-(--ink)',
        'transition-colors duration-(--duration-tip) ease-(--ease-out-quiet)',
        'hover:bg-(--surface-hover) disabled:opacity-40 disabled:hover:bg-(--surface-raised)',
      )}
    >
      {children}
    </button>
  );
}
