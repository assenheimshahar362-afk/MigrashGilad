'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A statistic that counts up the first time it scrolls into view.
 *
 * It takes the whole display string ("40+", "100%", "2019") and animates only
 * the leading number, keeping any prefix and suffix fixed. That means the
 * markup stays a single readable value rather than three spans, and a string
 * with no digits at all simply renders as-is.
 *
 * Three things keep it honest:
 *   - The final value is in the DOM from the first paint, so it is correct with
 *     no JavaScript, in a crawler, and to a screen reader — the animation only
 *     ever replaces text that is already there.
 *   - `prefers-reduced-motion` skips it entirely.
 *   - It runs once. Re-counting a number someone has already read is noise.
 */
export function CountUp({ value, durationMs = 1100 }: { value: string; durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const match = /^(\D*)(\d[\d,]*)(.*)$/.exec(value);
    if (!match) return;

    const [, prefix = '', digits = '', suffix = ''] = match;
    const target = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(target) || target === 0) return;

    let frame = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const progress = Math.min((now - start) / durationMs, 1);
      // Ease-out: the number should land, not coast in at a constant rate.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(`${prefix}${Math.round(target * eased).toLocaleString('he-IL')}${suffix}`);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          setDisplay(`${prefix}0${suffix}`);
          frame = requestAnimationFrame(tick);
        }
      },
      { rootMargin: '0px 0px -15% 0px' },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs]);

  return <span ref={ref}>{display}</span>;
}
