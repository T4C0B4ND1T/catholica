import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { SourceError } from '@/lib/sources/http';
import {
  bulletinUrl,
  DISCOVERMASS_PAGE,
  extractPdfText,
  fetchBulletinPdf,
  parseBulletinDate,
  parseDiscoverMass,
  toStorableText,
} from '@/lib/sources/bulletins';

const dmHtml = readFileSync(join(__dirname, '../fixtures/discovermass/st-anselm.html'), 'utf8');
const DM_PDF = 'https://bulletins.discovermass.com/download.php?bulletin=WXDLGdDxWwNnNpD20cSAmC2O5TtMTD4fo8Qr96bFIKPcfWvjDWbMpEDk6jGH6Qe6aKu4sKNgDlxTwpiKa0sFFR4DDkKjYtK34zVDpU9FTrA%3D';
// Monday 2026-11-09, noon in Chicago.
const NOW = new Date('2026-11-09T18:00:00Z');
const pdf = () => new Uint8Array(readFileSync(join(__dirname, '../fixtures/bulletins/20261018.pdf')));

afterEach(() => vi.unstubAllGlobals());

describe('bulletinUrl', () => {
  it('maps a Sunday to the ecatholic file', () => {
    expect(bulletinUrl('2026-10-18')).toBe('https://files.ecatholic.com/17181/bulletins/20261018.pdf');
  });
});

describe('extractPdfText', () => {
  it('reads the real fixture', async () => {
    const bytes = pdf();
    const { text, pageCount } = await extractPdfText(bytes);
    expect(pageCount).toBeGreaterThan(0);
    expect(text).toContain('Anselm');
    expect(bytes.byteLength).toBeGreaterThan(1000); // caller's buffer not detached
  });
});

describe('toStorableText', () => {
  // The 2026-09-27 bulletin's text held three NULs, which Postgres rejected ("unsupported Unicode escape sequence").
  it('drops NUL and unpaired surrogates, keeping everything else', () => {
    expect(toStorableText('St.\u0000 Anselm \ud800Parish – ✝')).toBe('St. Anselm �Parish – ✝');
  });
});

describe('parseBulletinDate', () => {
  it('reads short and long month names', () => {
    expect(parseBulletinDate('Nov 8, 2026')).toBe('2026-11-08');
    expect(parseBulletinDate(' November 15, 2026 ')).toBe('2026-11-15');
    expect(parseBulletinDate('Sept. 27, 2026')).toBe('2026-09-27');
  });
  it('returns null without a date', () => {
    expect(parseBulletinDate('current bulletin')).toBeNull();
    expect(parseBulletinDate('Foo 8, 2026')).toBeNull();
  });
});

describe('parseDiscoverMass', () => {
  it('finds the current bulletin date and download link', () => {
    expect(parseDiscoverMass(dmHtml)).toEqual({ sunday: '2026-11-08', url: DM_PDF });
  });
  it('returns null when no bulletin is linked', () => {
    expect(parseDiscoverMass('<html><body>No bulletin</body></html>')).toBeNull();
  });
});

describe('fetchBulletinPdf', () => {
  /** Answers each URL from the map; anything else is a 404. */
  const route = (map: Record<string, () => Response>) => {
    const f = vi.fn(async (url: string) => (map[url] ?? (() => new Response('', { status: 404 })))());
    vi.stubGlobal('fetch', f);
    return f;
  };
  const ec = (d: string) => bulletinUrl(d);

  it('returns the ecatholic PDF and its URL', async () => {
    const f = route({ [ec('2026-11-08')]: () => new Response(pdf(), { status: 200 }) });
    const out = await fetchBulletinPdf('2026-11-08', NOW);
    expect(out && new TextDecoder().decode(out.bytes.slice(0, 4))).toBe('%PDF');
    expect(out?.sourceUrl).toBe(ec('2026-11-08'));
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('falls back to Discover Mass when ecatholic does not have the week', async () => {
    route({
      [ec('2026-11-08')]: () => new Response('<Error/>', { status: 403 }),
      [DISCOVERMASS_PAGE]: () => new Response(dmHtml, { status: 200 }),
      [DM_PDF]: () => new Response(pdf(), { status: 200 }),
    });
    const out = await fetchBulletinPdf('2026-11-08', NOW);
    expect(out?.sourceUrl).toBe(DISCOVERMASS_PAGE);
    expect(out && new TextDecoder().decode(out.bytes.slice(0, 4))).toBe('%PDF');
  });
  it('returns null when Discover Mass shows a different week', async () => {
    const f = route({ [DISCOVERMASS_PAGE]: () => new Response(dmHtml, { status: 200 }) });
    expect(await fetchBulletinPdf('2026-11-01', NOW)).toBeNull();
    expect(f).not.toHaveBeenCalledWith(DM_PDF, expect.anything());
  });
  it('skips Discover Mass for older Sundays', async () => {
    const f = route({});
    expect(await fetchBulletinPdf('2026-10-18', NOW)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('throws when both sources fail', async () => {
    route({
      [ec('2026-11-08')]: () => new Response('', { status: 500 }),
      [DISCOVERMASS_PAGE]: () => new Response('', { status: 500 }),
    });
    await expect(fetchBulletinPdf('2026-11-08', NOW)).rejects.toBeInstanceOf(SourceError);
  });
  it('throws when Discover Mass is down and ecatholic has nothing', async () => {
    route({ [DISCOVERMASS_PAGE]: () => new Response('', { status: 503 }) });
    await expect(fetchBulletinPdf('2026-11-08', NOW)).rejects.toThrow(/503/);
  });
  it('rejects a body that is not a PDF', async () => {
    route({ [ec('2026-11-08')]: () => new Response('<html>challenge</html>', { status: 200 }) });
    await expect(fetchBulletinPdf('2026-11-08', NOW)).rejects.toThrow(/PDF/);
  });
});
