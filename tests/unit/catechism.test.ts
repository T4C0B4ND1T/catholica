import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  postForm: vi.fn(),
  requireUser: vi.fn(),
  askCatechism: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/sources/http', () => ({ postForm: h.postForm, SourceError: class extends Error {} }));
vi.mock('@/lib/auth/require-user', () => ({ requireUser: h.requireUser }));
vi.mock('@/lib/ai/writer', () => ({ askCatechism: h.askCatechism }));

import { fetchCatechism, parseCatechismResponse, parseCatechismSearch, searchCatechism } from '@/lib/sources/catechism';
import { POST } from '@/app/api/catechism/ask/route';
import { GET as search } from '@/app/api/catechism/search/route';
import { GET as lookup } from '@/app/api/catechism/[num]/route';

const fixture = JSON.parse(readFileSync('tests/fixtures/catechism/1324.json', 'utf8'));
const summit = JSON.parse(readFileSync('tests/fixtures/catechism/search-source-and-summit.json', 'utf8'));
const purgatory = JSON.parse(readFileSync('tests/fixtures/catechism/search-purgatory.json', 'utf8'));
const searchReq = (q: string | null) =>
  search(new Request(`http://x/api/catechism/search${q === null ? '' : `?q=${encodeURIComponent(q)}`}`));
const ask = (body: unknown) =>
  POST(new Request('http://x/api/catechism/ask', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  h.postForm.mockReset();
  h.requireUser.mockReset();
  h.askCatechism.mockReset();
});

describe('parseCatechismResponse', () => {
  it('parses paragraph 1324 verbatim', () => {
    const p = parseCatechismResponse(fixture, 1324)!;
    expect(p.num).toBe(1324);
    expect(p.title).toBe('I. THE EUCHARIST — SOURCE AND SUMMIT OF ECCLESIAL LIFE');
    expect(p.text).toContain('source and summit');
    expect(p.text).not.toMatch(/\d{3}$|<|SUP/);
    expect(p.text).toMatch(/our Pasch\."$/);
    expect(p.footnotes).toEqual(['136. LG 11.', '137. PO 5.']);
    expect(p.crossRefs).toEqual([864]);
    expect(p.sourceUrl).toBe('https://www.catholiccrossreference.online/catechism/#!/search/1324');
  });

  it('strips bare <sup> footnote markers too', () => {
    const bare = { html: fixture.html.replace(/<a [^>]*><SUP>(\d+)<\/SUP><\/a>/g, '<SUP>$1</SUP>') };
    expect(bare.html).toContain('<SUP>136</SUP>');
    const p = parseCatechismResponse(bare, 1324)!;
    expect(p.text).toBe(parseCatechismResponse(fixture, 1324)!.text);
    expect(p.text).not.toMatch(/136|137/);
  });

  it('returns null when the paragraph is absent', () => {
    expect(parseCatechismResponse(fixture, 1325)).toBeNull();
  });
});

describe('parseCatechismSearch', () => {
  it('lists every paragraph of a phrase search verbatim, with the total', () => {
    const r = parseCatechismSearch(summit);
    expect(r.total).toBe(2);
    expect(r.paragraphs.map((p) => p.num)).toEqual([1324, 2031]);
    expect(r.paragraphs[0]).toEqual(parseCatechismResponse(fixture, 1324));
    expect(r.paragraphs[1].text).toMatch(/source and summit/i);
  });

  it('lists the purgatory paragraphs', () => {
    const r = parseCatechismSearch(purgatory);
    expect(r.total).toBe(5);
    expect(r.paragraphs.map((p) => p.num)).toEqual([1030, 1031, 1472, 1475, 1498]);
    for (const p of r.paragraphs) {
      expect(p.text.length).toBeGreaterThan(0);
      expect(p.text).not.toMatch(/<|SUP/);
    }
    expect(r.paragraphs[0].title).toBe('III. THE FINAL PURIFICATION, OR PURGATORY');
  });

  it('is empty when nothing matches', () => {
    expect(parseCatechismSearch({ html: '<div></div>' })).toEqual({ total: 0, paragraphs: [] });
  });
});

describe('searchCatechism', () => {
  it('posts the words as the query, first page', async () => {
    h.postForm.mockResolvedValue(JSON.stringify(purgatory));
    expect((await searchCatechism('purgatory')).total).toBe(5);
    expect(h.postForm).toHaveBeenCalledWith('https://www.catholiccrossreference.online/catechism/', {
      TOKEN: '1', lang: 'en', query: 'purgatory', offset: '0',
    });
  });

  it('throws on a non-JSON answer', async () => {
    h.postForm.mockResolvedValue('<html>maintenance</html>');
    await expect(searchCatechism('purgatory')).rejects.toThrow();
  });
});

describe('GET /api/catechism/search', () => {
  it('rejects empty, short and overlong queries without a source call', async () => {
    for (const q of [null, '', ' ', 'a', 'x'.repeat(101)]) expect((await searchReq(q)).status).toBe(400);
    expect(h.postForm).not.toHaveBeenCalled();
  });

  it('returns verbatim results with an edge cache', async () => {
    h.postForm.mockResolvedValue(JSON.stringify(summit));
    const res = await searchReq('"source and summit"');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=\d+/);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.paragraphs.map((p: { num: number }) => p.num)).toEqual([1324, 2031]);
    expect(h.postForm).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ query: '"source and summit"' }));
  });

  it('is 502 when the source fails or answers garbage', async () => {
    h.postForm.mockRejectedValue(new Error('down'));
    expect((await searchReq('purgatory')).status).toBe(502);
    h.postForm.mockResolvedValue('not json');
    expect((await searchReq('purgatory')).status).toBe(502);
  });
});

describe('fetchCatechism', () => {
  it('throws on a non-JSON answer, so the route says 502, not 404', async () => {
    h.postForm.mockResolvedValue('<html>maintenance</html>');
    await expect(fetchCatechism(1324)).rejects.toThrow();
    const res = await lookup(new Request('http://x/api/catechism/1324'), { params: Promise.resolve({ num: '1324' }) });
    expect(res.status).toBe(502);
  });

  it.each([0, 2866, 1.5, NaN])('returns null for %s without a network call', async (n) => {
    expect(await fetchCatechism(n)).toBeNull();
    expect(h.postForm).not.toHaveBeenCalled();
  });

  it('posts the query and parses', async () => {
    h.postForm.mockResolvedValue(JSON.stringify(fixture));
    expect((await fetchCatechism(1324))?.num).toBe(1324);
    expect(h.postForm).toHaveBeenCalledWith('https://www.catholiccrossreference.online/catechism/', {
      TOKEN: '1', lang: 'en', query: '1324', offset: '0',
    });
  });
});

describe('POST /api/catechism/ask', () => {
  it('returns 401 signed out', async () => {
    h.requireUser.mockRejectedValue(new Response('{}', { status: 401 }));
    expect((await ask({ question: 'What is the Eucharist?' })).status).toBe(401);
    expect(h.askCatechism).not.toHaveBeenCalled();
  });

  it('rejects empty and overlong questions', async () => {
    h.requireUser.mockResolvedValue({ id: 'u', email: 'e' });
    expect((await ask({ question: '  ' })).status).toBe(400);
    expect((await ask({ question: 'x'.repeat(501) })).status).toBe(400);
    expect((await ask({})).status).toBe(400);
  });

  it('returns only verified paragraph numbers', async () => {
    h.requireUser.mockResolvedValue({ id: 'u', email: 'e' });
    h.askCatechism.mockResolvedValue('See CCC 1324 and CCC 9999, also CCC 1324 and CCC 3000.');
    h.postForm.mockImplementation(async (_u: string, f: Record<string, string>) =>
      f.query === '1324' ? JSON.stringify(fixture) : JSON.stringify({ html: '<div></div>' }),
    );
    const res = await ask({ question: 'What is the Eucharist?' });
    expect(await res.json()).toEqual({
      answer: 'See CCC 1324 and CCC 9999, also CCC 1324 and CCC 3000.',
      paragraphs: [1324],
    });
  });
});
