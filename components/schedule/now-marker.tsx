'use client';

import { useEffect, useState } from 'react';
import { minutesSinceMidnight, todayLocal } from '@/lib/time';
import { t } from '@/lib/i18n';

/**
 * FR-5: a live marker on today's column, updated every 60 s.
 *
 * §11.3 signature: the marker is a floodlight-amber line with a small
 * centre-spot dot — the ::after in globals.css draws the spot, positioned with
 * `inset-inline-end` so it sits on the touchline side in RTL.
 *
 * It renders only after mount. Server-rendering a "now" line would bake the
 * build time into a statically rendered page (NFR-3) and show the wrong hour.
 */
export function NowMarker({
  date,
  startMinute,
  endMinute,
}: {
  date: string;
  startMinute: number;
  endMinute: number;
}) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setMinutes(todayLocal(now) === date ? minutesSinceMidnight(now) : null);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [date]);

  if (minutes === null || minutes < startMinute || minutes > endMinute) return null;

  const top = ((minutes - startMinute) / (endMinute - startMinute)) * 100;

  return (
    <div
      className="now-marker pointer-events-none absolute inset-x-0 z-20 h-0.5"
      style={{ top: `${top}%` }}
      role="presentation"
      aria-label={t('schedule.now')}
    />
  );
}
