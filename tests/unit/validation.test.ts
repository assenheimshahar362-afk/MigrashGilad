import { describe, expect, it } from 'vitest';
import { createRequestInput, israeliMobile, normalisePhone } from '@/lib/validation/request';

/**
 * §18.2: phone normalisation, Zod schemas.
 *
 * Acceptance scenario 12: `054-1234567`, `0541234567` and `+972541234567` all
 * normalise to the same stored value.
 */
describe('Israeli mobile normalisation (FR-12)', () => {
  const expected = '+972541234567';

  it.each([
    '054-1234567',
    '0541234567',
    '+972541234567',
    '054 123 4567',
    '+972 54-123-4567',
  ])('normalises %s to E.164', (input) => {
    expect(israeliMobile.parse(input)).toBe(expected);
    expect(normalisePhone(input)).toBe(expected);
  });

  it.each([
    '03-1234567', // landline
    '04123456', // too short
    '+15551234567', // not Israeli
    '0541234', // too short
    '05412345678', // too long
    'not a phone',
  ])('rejects %s', (input) => {
    expect(israeliMobile.safeParse(input).success).toBe(false);
    expect(normalisePhone(input)).toBeNull();
  });
});

describe('createRequestInput (§8)', () => {
  const valid = {
    requesterName: 'יעל בר-אילן',
    requesterPhone: '054-1234567',
    usageType: 'community' as const,
    start: '2026-08-05T15:00:00.000Z',
    end: '2026-08-05T17:00:00.000Z',
    consent: true as const,
    turnstileToken: 'token',
  };

  it('accepts a well-formed request and normalises the phone', () => {
    const result = createRequestInput.parse(valid);
    expect(result.requesterPhone).toBe('+972541234567');
  });

  it('rejects unknown keys — .strict(), not merely ignored (§7)', () => {
    const result = createRequestInput.safeParse({ ...valid, isAdmin: true });
    expect(result.success).toBe(false);
  });

  it('requires explicit consent', () => {
    expect(createRequestInput.safeParse({ ...valid, consent: false }).success).toBe(false);
  });

  it('rejects a usage type outside the two recognised categories', () => {
    expect(createRequestInput.safeParse({ ...valid, usageType: 'maintenance' }).success).toBe(false);
  });

  it('rejects a name shorter than two characters', () => {
    expect(createRequestInput.safeParse({ ...valid, requesterName: 'א' }).success).toBe(false);
  });
});
