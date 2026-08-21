import { describe, expect, it } from 'vitest';
import { ERROR_CODES, codeFromDbError, errorMessage } from '@/lib/errors';
import { eventDisplayTitle, toPublicEvent } from '@/lib/types';
import { formatIsraeliPhone, whatsappNumber } from '@/lib/utils';
import type { EventRow } from '@/lib/types';

/** §18.2: error-code mapping, and the projections that keep PII server-side. */
describe('error code to Hebrew message (§8)', () => {
  it('has a Hebrew message for every code in the contract', () => {
    for (const code of ERROR_CODES) {
      const message = errorMessage(code);
      expect(message).not.toBe('');
      // A code that fell through to the generic message means a missing string.
      if (code !== 'ERR_INTERNAL') {
        expect(message).not.toBe(errorMessage('ERR_INTERNAL'));
      }
    }
  });

  it('interpolates variables into a parameterised message', () => {
    expect(errorMessage('ERR_LEAD_TIME', { hours: 12 })).toContain('12');
  });
});

describe('codeFromDbError', () => {
  /**
   * The exclusion constraint behind `events_no_overlap` reports as SQLSTATE
   * 23P01 with no ERR_ code in the message. G4 depends on this mapping.
   */
  it('maps 23P01 to ERR_SLOT_CONFLICT', () => {
    expect(codeFromDbError({ code: '23P01', message: 'conflicting key value' })).toBe(
      'ERR_SLOT_CONFLICT',
    );
  });

  it('extracts a raised ERR_ code from a PostgREST message', () => {
    expect(codeFromDbError({ message: 'ERR_LAST_SUPER_ADMIN' })).toBe('ERR_LAST_SUPER_ADMIN');
    expect(
      codeFromDbError({ message: 'P0001', details: 'ERR_CANNOT_DEMOTE_SELF' }),
    ).toBe('ERR_CANNOT_DEMOTE_SELF');
  });

  it('reduces anything unrecognised to ERR_INTERNAL', () => {
    expect(codeFromDbError(new Error('boom'))).toBe('ERR_INTERNAL');
    expect(codeFromDbError(null)).toBe('ERR_INTERNAL');
  });
});

describe('public projections (§7 PII)', () => {
  const baseEvent: EventRow = {
    id: 'e1',
    title: 'יעל בר-אילן',
    description: null,
    requester_note: 'אימון כדורגל לילדי השכונה',
    show_note: false,
    usage_type: 'community',
    starts_at: '2026-08-05T14:00:00.000Z',
    ends_at: '2026-08-05T16:00:00.000Z',
    status: 'scheduled',
    source: 'request',
    request_id: 'r1',
    recurring_id: null,
    occurrence_date: null,
    contact_name: 'יעל בר-אילן',
    contact_phone: '+972541234567',
    show_contact: false,
    created_by: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  };

  it('withholds the contact phone unless show_contact is true', () => {
    expect(toPublicEvent(baseEvent).contactPhone).toBeNull();
    expect(toPublicEvent({ ...baseEvent, show_contact: true }).contactPhone).toBe('+972541234567');
  });

  it('withholds the requester note unless show_note is true', () => {
    expect(toPublicEvent(baseEvent).requesterNote).toBeNull();
    expect(toPublicEvent({ ...baseEvent, show_note: true }).requesterNote).toBe(
      'אימון כדורגל לילדי השכונה',
    );
  });

  /** The calendar names whoever booked the pitch in full, not just a first name. */
  it('shows an approved request under the requester full name', () => {
    expect(eventDisplayTitle(toPublicEvent(baseEvent))).toBe('יעל בר-אילן');
  });
});

describe('phone formatting (§11.4)', () => {
  it('renders E.164 the way an Israeli reads it', () => {
    expect(formatIsraeliPhone('+972541234567')).toBe('054-1234567');
  });

  it('strips everything but digits for wa.me', () => {
    expect(whatsappNumber('+972541234567')).toBe('972541234567');
  });
});
