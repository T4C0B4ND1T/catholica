import { describe, expect, it } from 'vitest';
import { showsThisSunday } from '@/lib/this-sunday';

describe('showsThisSunday', () => {
  it('is hidden on Sunday and shown Monday through Saturday', () => {
    // 2026-10-25 is a Sunday.
    expect(showsThisSunday('2026-10-25')).toBe(false);
    for (const d of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']) {
      expect(showsThisSunday(d)).toBe(true);
    }
  });
});
