import { describe, expect, it } from 'vitest';
import { eventStyle, usageTypeLabel, usageTypeStyle } from '@/lib/usage-type';

describe('eventStyle', () => {
  it.each(['community', 'association'] as const)(
    'keeps the %s palette for generic availability titles',
    (type) => {
      expect(eventStyle(usageTypeLabel(type), type)).toEqual(usageTypeStyle(type));
    },
  );

  it('uses the green palette for a named community event', () => {
    const style = eventStyle('משחק שכונתי', 'community');

    expect(style.block).toContain('bg-success-50');
    expect(style.bar).toBe('bg-success');
    expect(style.label).toBe(usageTypeLabel('community'));
  });

  it('keeps named association events yellow', () => {
    const style = eventStyle('חוג כדורגל', 'association');

    expect(style).toEqual(usageTypeStyle('association'));
    expect(style.block).toContain('bg-warning-50');
  });
});
