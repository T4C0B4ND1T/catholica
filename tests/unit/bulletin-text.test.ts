import { describe, expect, it } from 'vitest';
import { snippetParts, validBulletinDate } from '@/lib/bulletin-text';

describe('snippetParts', () => {
  it('splits only <mark> tags and leaves other markup as literal text', () => {
    expect(snippetParts('Feast of <mark>Anselm</mark> <b>now</b><script>x</script>')).toEqual([
      { text: 'Feast of ', mark: false },
      { text: 'Anselm', mark: true },
      { text: ' <b>now</b><script>x</script>', mark: false },
    ]);
  });
  it('handles no marks and empty input', () => {
    expect(snippetParts('plain')).toEqual([{ text: 'plain', mark: false }]);
    expect(snippetParts('')).toEqual([]);
  });
});

describe('validBulletinDate', () => {
  it('accepts real dates in range and rejects the rest', () => {
    expect(validBulletinDate('2026-10-25')).toBe(true);
    expect(validBulletinDate('2026-02-30')).toBe(false);
    expect(validBulletinDate('1969-12-28')).toBe(false);
    expect(validBulletinDate('2101-01-01')).toBe(false);
    expect(validBulletinDate('nope')).toBe(false);
  });
});
