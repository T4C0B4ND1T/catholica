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
vi.mock('@/lib/ai/gemini', () => ({ askCatechism: h.askCatechism }));

import { fetchCatechism, parseCatechismResponse } from '@/lib/sources/catechism';
import { POST } from '@/app/api/catechism/ask/route';

const fixture = JSON.parse(readFileSync('tests/fixtures/catechism/1324.json', 'utf8'));
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

  it('returns null when the paragraph is absent', () => {
    expect(parseCatechismResponse(fixture, 1325)).toBeNull();
  });
});

describe('fetchCatechism', () => {
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
