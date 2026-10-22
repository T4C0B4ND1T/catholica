import { describe, expect, it } from 'vitest';
import { notesMarkdown } from '@/lib/me/export';

describe('notesMarkdown', () => {
  it('lists non-empty notes oldest first under their dates', () => {
    expect(
      notesMarkdown([
        { date: '2026-10-25', body: 'Sunday thought\n\nsecond line ' },
        { date: '2026-10-21', body: 'First' },
        { date: '2026-10-22', body: '   ' },
      ]),
    ).toBe('# Catholica notes\n\n## Wed, Oct 21, 2026\n\nFirst\n\n## Sun, Oct 25, 2026\n\nSunday thought\n\nsecond line\n');
  });
});
