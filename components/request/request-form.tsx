'use client';

import { useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { t, isMessageKey } from '@/lib/i18n';
import { requestFormSchema, type RequestFormValues } from '@/lib/validation/request';
import { type PublicSettings } from '@/lib/types';
import { addLocalDays, toInstant, todayLocal } from '@/lib/time';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { AvailabilityHint } from '@/components/request/availability-hint';
import { Turnstile } from '@/components/request/turnstile';
import { SuccessPanel } from '@/components/request/success-panel';

/**
 * §10.3: a single-column form, stepped on mobile into three short steps so each
 * screen stays within one thumb-reach — מתי / מה / מי.
 *
 * G2: a resident should be done in under 60 seconds. That budget is why the
 * phone field opens the numeric keypad and there is no account to create.
 * Duration is not its own field — it is start and end time, and asking for
 * it a third way just gave two controls a chance to disagree.
 */
const STEPS = ['when', 'what', 'who'] as const;
type Step = (typeof STEPS)[number];

export function RequestForm({
  settings,
  prefill,
}: {
  settings: PublicSettings;
  prefill: { date?: string; start?: string; end?: string };
}) {
  const [step, setStep] = useState<Step>('when');
  const [serverError, setServerError] = useState<string | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [result, setResult] = useState<{ statusUrl: string; token: string } | null>(null);
  const turnstileToken = useRef<string | null>(null);

  // FR-17: the pickers are bounded by lead time and horizon, so an impossible
  // date cannot be chosen in the first place — the server still enforces both.
  const minDate = leadTimeDate(settings.minLeadHours);
  const maxDate = addLocalDays(todayLocal(), settings.maxHorizonDays);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    mode: 'onTouched',
    defaultValues: {
      date: prefill.date ?? minDate,
      startTime: prefill.start ?? '17:00',
      endTime: prefill.end ?? '18:00',
      usageType: 'community',
      participants: '',
      note: '',
      requesterName: '',
      requesterPhone: '',
      consent: true as const,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setFocus,
    formState: { errors, isSubmitting },
  } = form;

  const values = watch();
  const onToken = useCallback((token: string) => {
    turnstileToken.current = token;
  }, []);

  if (result) {
    return (
      <SuccessPanel
        statusUrl={result.statusUrl}
        date={values.date}
        startTime={values.startTime}
        endTime={values.endTime}
      />
    );
  }

  const goNext = async () => {
    const fields: Record<Step, Array<keyof RequestFormValues>> = {
      when: ['date', 'startTime', 'endTime'],
      what: ['participants', 'note'],
      who: ['requesterName', 'requesterPhone', 'consent'],
    };

    const valid = await trigger(fields[step]);
    if (!valid) {
      // A11Y-6: the first invalid field receives focus.
      const firstInvalid = fields[step].find((name) => errors[name]);
      if (firstInvalid) setFocus(firstInvalid);
      return;
    }

    const index = STEPS.indexOf(step);
    if (index < STEPS.length - 1) setStep(STEPS[index + 1]!);
  };

  const goBack = () => {
    const index = STEPS.indexOf(step);
    if (index > 0) setStep(STEPS[index - 1]!);
  };

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    setQueuedOffline(false);

    const body = {
      requesterName: data.requesterName,
      requesterPhone: data.requesterPhone,
      usageType: data.usageType,
      start: toInstant(data.date, data.startTime).toISOString(),
      end: toInstant(data.date, data.endTime).toISOString(),
      participants: data.participants ? Number(data.participants) : undefined,
      note: data.note.trim() ? data.note.trim() : undefined,
      consent: true as const,
      turnstileToken: turnstileToken.current ?? 'development-no-turnstile',
    };

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as
        | { statusUrl: string; publicToken: string }
        | { error: { code: string; message: string } };

      if (!response.ok || 'error' in payload) {
        const message =
          'error' in payload ? payload.error.message : t('error.generic');
        setServerError(message);
        return;
      }

      setResult({ statusUrl: payload.statusUrl, token: payload.publicToken });
    } catch {
      // §12: the service worker's Background Sync queue has taken the POST.
      // Telling the visitor it failed would be wrong — it will be delivered.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setQueuedOffline(true);
      } else {
        setServerError(t('error.generic'));
      }
    }
  });

  const stepIndex = STEPS.indexOf(step);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <StepIndicator step={step} />

      {step === 'when' ? (
        <fieldset className="space-y-4">
          <legend className="sr-only">{t('request.step.when')}</legend>

          <Field id="date" label={t('request.field.date')} required error={fieldError(errors.date?.message)}>
            {(props) => (
              <Input type="date" min={minDate} max={maxDate} {...props} {...register('date')} />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              id="startTime"
              label={t('request.field.start')}
              required
              error={fieldError(errors.startTime?.message)}
            >
              {(props) => <Input type="time" step={900} {...props} {...register('startTime')} />}
            </Field>

            <Field
              id="endTime"
              label={t('request.field.end')}
              required
              error={fieldError(errors.endTime?.message)}
            >
              {(props) => <Input type="time" step={900} {...props} {...register('endTime')} />}
            </Field>
          </div>

          <AvailabilityHint
            date={values.date}
            startTime={values.startTime}
            endTime={values.endTime}
          />
        </fieldset>
      ) : null}

      {step === 'what' ? (
        <fieldset className="space-y-4">
          <legend className="sr-only">{t('request.step.what')}</legend>

          {/* No usage-type picker here: a public request is always community
              time (§ usage type is an admin-only distinction, set directly on
              a calendar event for the association's own use) — `usageType`
              stays 'community' from the form's defaultValues, unedited. */}
          <Field
            id="participants"
            label={t('request.field.participants')}
            error={fieldError(errors.participants?.message)}
          >
            {(props) => (
              <Input type="number" inputMode="numeric" min={1} max={200} {...props} {...register('participants')} />
            )}
          </Field>

          <Field id="note" label={t('request.field.note')} error={fieldError(errors.note?.message)}>
            {(props) => <Textarea maxLength={500} {...props} {...register('note')} />}
          </Field>
        </fieldset>
      ) : null}

      {step === 'who' ? (
        <fieldset className="space-y-4">
          <legend className="sr-only">{t('request.step.who')}</legend>

          <Field
            id="requesterName"
            label={t('request.field.name')}
            required
            error={fieldError(errors.requesterName?.message)}
          >
            {(props) => (
              <Input
                type="text"
                autoComplete="name"
                enterKeyHint="next"
                {...props}
                {...register('requesterName')}
              />
            )}
          </Field>

          <Field
            id="requesterPhone"
            label={t('request.field.phone')}
            required
            hint="05X-XXXXXXX"
            error={fieldError(errors.requesterPhone?.message)}
          >
            {(props) => (
              <Input
                type="tel"
                // §10.3: numeric keypad, and an LTR field so the digits are not
                // reordered as they are typed into an RTL document.
                inputMode="tel"
                dir="ltr"
                autoComplete="tel"
                {...props}
                {...register('requesterPhone')}
              />
            )}
          </Field>

          <label
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-(--radius-input) p-3 text-sm',
              'border border-(--hairline) bg-(--surface-raised)',
              'transition-colors duration-(--duration-tip) ease-(--ease-out-quiet)',
              'hover:border-(--hairline-strong) hover:bg-(--surface-hover)',
              'has-checked:border-primary/40 has-checked:bg-primary-50',
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-primary"
              {...register('consent')}
            />
            <span>{t('request.field.consent')}</span>
          </label>
          {errors.consent ? (
            <p role="alert" className="text-sm font-semibold text-danger-ink">
              {t('error.ERR_VALIDATION')}
            </p>
          ) : null}

          <Turnstile onToken={onToken} />
        </fieldset>
      ) : null}

      {/* A11Y-7: a submission failure is the one thing announced assertively. */}
      {serverError ? (
        <p
          role="alert"
          aria-live="assertive"
          className="animate-rise-in flex items-start gap-2 rounded-(--radius-input) border border-danger/40 bg-danger/8 px-4 py-3 text-sm font-semibold text-danger-ink"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {serverError}
        </p>
      ) : null}

      {queuedOffline ? (
        <p
          role="status"
          className="animate-rise-in rounded-(--radius-input) border border-(--hairline) bg-(--surface-sunken) px-4 py-3 text-sm font-semibold"
        >
          {t('request.queued_offline')}
        </p>
      ) : null}

      <div className="flex gap-3 pt-2">
        {stepIndex > 0 ? (
          <Button type="button" variant="secondary" size="lg" onClick={goBack}>
            {t('request.back')}
          </Button>
        ) : null}

        {step === 'who' ? (
          <Button type="submit" size="lg" className="flex-1" loading={isSubmitting}>
            {isSubmitting ? t('request.submitting') : t('request.submit')}
          </Button>
        ) : (
          <Button type="button" size="lg" className="flex-1" onClick={goNext}>
            {t('request.next')}
            <ArrowLeft className="size-5" aria-hidden />
          </Button>
        )}
      </div>
    </form>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const index = STEPS.indexOf(step);
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <h2 className="text-h2">{t(`request.step.${step}` as const)}</h2>
        <p className="tnum ms-auto shrink-0 text-sm text-(--ink-faint)">
          {t('request.step_of', { current: index + 1, total: STEPS.length })}
        </p>
      </div>

      {/* The rail fills rather than jumping between discrete blocks: a width
          transition on the completed portion reads as progress, three swapping
          background colours read as a flicker. */}
      <ol className="mt-4 flex gap-2" aria-hidden>
        {STEPS.map((name, i) => (
          <li
            key={name}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--hairline)"
          >
            <span
              className={cn(
                'block h-full rounded-full bg-primary',
                'transition-[width] duration-500 ease-(--ease-out-quiet)',
                'motion-reduce:transition-none',
                i <= index ? 'w-full' : 'w-0',
              )}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Zod messages carry error CODES, not sentences, so that the same schema can be
 * reused on the server where the response format is `{ code, message }`. This
 * maps a code back to its Hebrew string at the point of render.
 */
function fieldError(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const key = `error.${message}`;
  return isMessageKey(key) ? t(key) : t('error.ERR_VALIDATION');
}

/** The earliest local date that satisfies the minimum lead time (FR-17). */
function leadTimeDate(minLeadHours: number): string {
  const earliest = new Date(Date.now() + minLeadHours * 60 * 60 * 1000);
  return earliest.toISOString().slice(0, 10);
}
