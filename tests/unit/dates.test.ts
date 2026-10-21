import { describe, expect, it } from 'vitest';
import { addDays, dayOfWeek, todayInChicago, usccbSlug } from '@/lib/dates';

describe('dates', () => {
  it('todayInChicago uses Chicago local date', () => {
    expect(todayInChicago(new Date('2026-10-25T04:30:00Z'))).toBe('2026-10-24');
    expect(todayInChicago(new Date('2026-11-01T06:30:00Z'))).toBe('2026-11-01');
  });
  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('dayOfWeek is 0 for Sunday', () => {
    expect(dayOfWeek('2026-10-25')).toBe(0);
    expect(dayOfWeek('2026-10-21')).toBe(3);
  });
  it('usccbSlug is MMDDYY', () => {
    expect(usccbSlug('2026-10-25')).toBe('102526');
  });
});
