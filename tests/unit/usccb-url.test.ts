import { describe, expect, it } from 'vitest';
import { usccbUrl } from '@/lib/sources/usccb-url';

describe('usccbUrl', () => {
  it('builds the MMDDYY readings page', () => {
    expect(usccbUrl('2026-10-25')).toBe('https://bible.usccb.org/bible/readings/102526.cfm');
    expect(usccbUrl('2027-01-04')).toBe('https://bible.usccb.org/bible/readings/010427.cfm');
  });
});
