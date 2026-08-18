'use client';

import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { EventScope } from '@/lib/event-series';

/**
 * FR-33a: "this occurrence, or this one and every one after it?"
 *
 * Shown only for an event that actually repeats — a one-off has nothing to
 * choose between, and a choice with one real answer is a question the admin
 * has to read and dismiss every time they fix a typo.
 *
 * A radio group rather than two buttons on the confirm dialog: the same
 * control serves the edit form and the delete dialog, and the decision is
 * visible (and changeable) BEFORE the action is taken rather than being
 * attached to whichever button was pressed.
 *
 * `single` is the default everywhere, because it is the reversible one: the
 * cost of editing one occurrence when you meant the series is opening the
 * sheet again; the cost the other way is fifty rows to put back by hand.
 */
export function EventScopeChoice({
  value,
  onChange,
  disabled = false,
  followingLabel,
}: {
  value: EventScope;
  onChange: (scope: EventScope) => void;
  disabled?: boolean;
  /** Overrides the wording of the second option — the delete dialog says
   *  something rather more final than the edit form does. */
  followingLabel?: string;
}) {
  return (
    <fieldset
      className="rounded-(--radius-input) border border-(--hairline) bg-(--surface-sunken) p-4"
      disabled={disabled}
    >
      <legend className="px-1 text-xs font-semibold text-(--ink-muted)">
        {t('admin.scope.legend')}
      </legend>

      <div className="mt-1 space-y-1">
        <Option
          name="event-scope"
          checked={value === 'single'}
          onSelect={() => onChange('single')}
          label={t('admin.scope.single')}
        />
        <Option
          name="event-scope"
          checked={value === 'following'}
          onSelect={() => onChange('following')}
          label={followingLabel ?? t('admin.scope.following')}
          help={t('admin.scope.following_help')}
        />
      </div>
    </fieldset>
  );
}

/**
 * One radio and its label, as a single tap target the full width of the group
 * — A11Y-1's 44px is met by the row, not by the 20px dot inside it.
 */
function Option({
  name,
  checked,
  onSelect,
  label,
  help,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
  help?: string;
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-start gap-3 rounded-(--radius-input) px-2 py-2',
        'transition-colors duration-(--duration-tip) ease-(--ease-out-quiet)',
        'hover:bg-(--surface-hover) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 size-5 shrink-0 accent-(--color-floodlight)"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-(--ink)">{label}</span>
        {help && checked ? (
          <span className="mt-0.5 block text-xs text-(--ink-muted)">{help}</span>
        ) : null}
      </span>
    </label>
  );
}
