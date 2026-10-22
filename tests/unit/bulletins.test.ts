import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { SourceError } from '@/lib/sources/http';
import { bulletinUrl, extractPdfText, fetchBulletinPdf } from '@/lib/sources/bulletins';

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

describe('fetchBulletinPdf', () => {
  const stub = (res: Response) => vi.stubGlobal('fetch', vi.fn(async () => res));

  it('returns the bytes of a PDF', async () => {
    stub(new Response(pdf(), { status: 200 }));
    const out = await fetchBulletinPdf('2026-10-18');
    expect(out && new TextDecoder().decode(out.slice(0, 4))).toBe('%PDF');
  });
  it('returns null for 403 and 404 (not posted)', async () => {
    stub(new Response('<Error/>', { status: 403 }));
    expect(await fetchBulletinPdf('2026-10-25')).toBeNull();
    stub(new Response('', { status: 404 }));
    expect(await fetchBulletinPdf('2026-10-25')).toBeNull();
  });
  it('throws SourceError on other statuses', async () => {
    stub(new Response('', { status: 500 }));
    await expect(fetchBulletinPdf('2026-10-18')).rejects.toBeInstanceOf(SourceError);
  });
  it('rejects a body that is not a PDF', async () => {
    stub(new Response('<html>challenge</html>', { status: 200 }));
    await expect(fetchBulletinPdf('2026-10-18')).rejects.toThrow(/PDF/);
  });
});
