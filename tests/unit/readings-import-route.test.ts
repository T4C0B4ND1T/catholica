import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ getReadings: vi.fn(), saveReadings: vi.fn() }));
vi.mock('@/lib/db/readings', () => db);

import { POST } from '@/app/api/cron/readings/import/route';

const day = (date: string, over: Record<string, unknown> = {}) => ({
  date,
  feast: 'Thursday of the Twenty-ninth Week in Ordinary Time',
  lectionary: '476',
  sections: [{ kind: 'gospel', title: 'Gospel', citation: 'Luke 12:49-53', text: 'Jesus said to his disciples' }],
  sourceUrl: `https://bible.usccb.org/bible/readings/${date.slice(5, 7)}${date.slice(8)}${date.slice(2, 4)}.cfm`,
  fetchedAt: '2026-10-22T04:00:00.000Z',
  ...over,
});
const call = (body: unknown, auth = 'Bearer s3cret') =>
  POST(
    new Request('http://x/api/cron/readings/import', {
      method: 'POST',
      headers: { authorization: auth, 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

describe('POST /api/cron/readings/import', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    db.getReadings.mockReset().mockResolvedValue(null);
    db.saveReadings.mockReset().mockResolvedValue(undefined);
  });

  it('needs the cron secret', async () => {
    expect((await call([day('2026-10-22')], 'Bearer nope')).status).toBe(401);
    expect(db.saveReadings).not.toHaveBeenCalled();
  });

  it('saves new days and leaves saved ones alone', async () => {
    db.getReadings.mockImplementation(async (d: string) => (d === '2026-10-23' ? day(d) : null));
    const res = await call([day('2026-10-22'), day('2026-10-23')]);
    expect(await res.json()).toEqual({ saved: ['2026-10-22'], versed: [], skipped: ['2026-10-23'] });
    expect(db.saveReadings).toHaveBeenCalledTimes(1);
    expect(db.saveReadings.mock.calls[0][0]).toEqual(day('2026-10-22'));
  });

  it('keeps a Mass name and drops unknown fields', async () => {
    const extra = day('2025-12-25', {
      sections: [{ kind: 'gospel', mass: 'Mass at Dawn', title: 'Gospel', citation: 'Luke 2:15-20', text: 'x', z: 1 }],
      z: 1,
    });
    await call([extra]);
    const saved = db.saveReadings.mock.calls[0][0];
    expect(saved.sections[0]).toEqual({ kind: 'gospel', mass: 'Mass at Dawn', title: 'Gospel', citation: 'Luke 2:15-20', text: 'x' });
    expect('z' in saved).toBe(false);
  });

  it('adds verse numbers to a saved day whose text is the same', async () => {
    db.getReadings.mockImplementation(async (d: string) => day(d));
    const verses = [
      { at: 0, chapter: 12, verse: 49 },
      { at: 10, chapter: 12, verse: 50 },
    ];
    const g = day('2026-10-22').sections[0];
    const res = await call([day('2026-10-22', { sections: [{ ...g, verses }] })]);
    expect(await res.json()).toEqual({ saved: [], versed: ['2026-10-22'], skipped: [] });
    expect(db.saveReadings.mock.calls[0][0]).toEqual(day('2026-10-22', { sections: [{ ...g, verses }] }));
  });

  it('leaves a saved day alone when the uploaded text differs', async () => {
    db.getReadings.mockImplementation(async (d: string) => day(d));
    const g = day('2026-10-22').sections[0];
    const res = await call([day('2026-10-22', { sections: [{ ...g, text: 'Other words', verses: [{ at: 0, chapter: 1, verse: 1 }] }] })]);
    expect(await res.json()).toEqual({ saved: [], versed: [], skipped: ['2026-10-22'] });
    expect(db.saveReadings).not.toHaveBeenCalled();
  });

  it('keeps verse numbers a saved day already has', async () => {
    const g = day('2026-10-22').sections[0];
    db.getReadings.mockImplementation(async (d: string) => day(d, { sections: [{ ...g, verses: [{ at: 0, chapter: 12, verse: 49 }] }] }));
    const res = await call([day('2026-10-22', { sections: [{ ...g, verses: [{ at: 0, chapter: 1, verse: 1 }] }] })]);
    expect(await res.json()).toEqual({ saved: [], versed: [], skipped: ['2026-10-22'] });
  });

  const gospel = (verses: unknown) => [
    day('2026-10-22', { sections: [{ kind: 'gospel', title: 'G', citation: 'c', text: 'Jesus said', verses }] }),
  ];

  it.each([
    ['not JSON', '{'],
    ['verse marks out of order', gospel([{ at: 5, chapter: 1, verse: 2 }, { at: 0, chapter: 1, verse: 1 }])],
    ['a verse mark past the text', gospel([{ at: 99, chapter: 1, verse: 1 }])],
    ['a verse mark that is not a number', gospel([{ at: '0', chapter: 1, verse: 1 }])],
    ['an empty array', []],
    ['more than 31 days', Array.from({ length: 32 }, () => day('2026-10-22'))],
    ['a bad date', [day('2026-02-30')]],
    ['a source other than the day’s USCCB page', [day('2026-10-22', { sourceUrl: 'https://evil.example/x' })]],
    ['no sections', [day('2026-10-22', { sections: [] })]],
    ['an unknown kind', [day('2026-10-22', { sections: [{ kind: 'x', title: 'G', citation: 'c', text: 't' }] })]],
    ['an empty reading', [day('2026-10-22', { sections: [{ kind: 'gospel', title: 'G', citation: 'c', text: '' }] })]],
  ])('rejects %s with 400 and saves nothing', async (_name, body) => {
    expect((await call(body)).status).toBe(400);
    expect(db.saveReadings).not.toHaveBeenCalled();
  });
});
