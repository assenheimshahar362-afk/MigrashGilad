import { t } from '@/lib/i18n';

/**
 * §10.4: an "add to calendar" .ics download once a request is approved.
 *
 * Written by hand rather than pulled from a library: the file is twenty lines,
 * the RFC 5545 folding rules are the only subtlety, and a dependency here would
 * ship a full recurrence engine we never call.
 */
export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  title: string;
  description?: string;
  location?: string;
  url?: string;
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** RFC 5545 §3.1: lines are folded at 75 octets, continuations start with a space. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = '';
  for (const char of line) {
    const candidate = current + char;
    if (encoder.encode(candidate).length > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(event: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Migrash Gilad//Booking//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `LOCATION:${escapeText(event.location ?? t('app.name'))}`,
  ];

  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.url) lines.push(`URL:${event.url}`);

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(fold).join('\r\n');
}
