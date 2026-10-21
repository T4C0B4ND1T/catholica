import { describe, expect, it } from 'vitest';
import { pickRow } from '@/lib/me/validate';

const id = '0b6f0c1e-8a4f-4d38-9a51-7c1d2e3f4a5b';

describe('pickRow bookmarks', () => {
  it('accepts a per-section key and an old kind-only section', () => {
    expect(pickRow('bookmarks', { id, date: '2025-12-25', section: '19|Gospel, Mass during the Day' })).toEqual({
      id,
      date: '2025-12-25',
      section: '19|Gospel, Mass during the Day',
    });
    expect(pickRow('bookmarks', { id, date: '2026-10-25', section: 'gospel' })).not.toBeNull();
  });

  it('rejects free text, prototype names and control characters', () => {
    for (const section of ['anything', 'constructor', '1|a\u0000b', '', 7]) {
      expect(pickRow('bookmarks', { id, date: '2026-10-25', section })).toBeNull();
    }
  });
});
