import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ readReadings: vi.fn(), readReflection: vi.fn(), getInsights: vi.fn(), getStudy: vi.fn() }));
vi.mock('@/lib/db/readings', () => db);

import { GET } from '@/app/api/readings/[date]/route';

const call = (date: string) => GET(new Request(`http://x/api/readings/${date}`), { params: Promise.resolve({ date }) });
const readings = { date: '2026-10-21', feast: 'Feast', sections: [], fetchedAt: '2026-10-21T09:00:00Z' };

describe('GET /api/readings/[date]', () => {
  beforeEach(() => {
    db.readReadings.mockReset();
    db.readReflection.mockReset();
    db.getInsights.mockReset().mockResolvedValue({ theology: 'T', catechism: [], prayer: 'P' });
    db.getStudy.mockReset().mockResolvedValue({ level: 'brief', readings: [] });
  });

  it('caches a complete day for an hour', async () => {
    db.readReadings.mockResolvedValue(readings);
    db.readReflection.mockResolvedValue('A reflection');
    expect((await call('2026-10-21')).headers.get('Cache-Control')).toBe('public, s-maxage=3600');
  });

  it('caches a day still missing its insights only briefly, and returns them', async () => {
    db.readReadings.mockResolvedValue(readings);
    db.readReflection.mockResolvedValue('A reflection');
    db.getInsights.mockResolvedValue(null);
    const res = await call('2026-10-21');
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=60');
    expect((await res.json()).insights).toBeNull();
  });

  it('caches a day still missing its study guide only briefly, and returns it', async () => {
    db.readReadings.mockResolvedValue(readings);
    db.readReflection.mockResolvedValue('A reflection');
    db.getStudy.mockResolvedValue(null);
    const res = await call('2026-10-21');
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=60');
    expect((await res.json()).study).toBeNull();
  });

  it('caches a day still missing its reflection only briefly', async () => {
    db.readReadings.mockResolvedValue(readings);
    db.readReflection.mockResolvedValue(null);
    expect((await call('2026-10-21')).headers.get('Cache-Control')).toBe('public, s-maxage=60');
  });

  it('caches a day with no readings only briefly', async () => {
    db.readReadings.mockResolvedValue(null);
    db.readReflection.mockResolvedValue(null);
    expect((await call('2026-10-21')).headers.get('Cache-Control')).toBe('public, s-maxage=60');
  });

  it.each(['2026-02-30', '1969-12-31', '2101-01-01', 'today'])('rejects %s with 400', async (date) => {
    expect((await call(date)).status).toBe(400);
    expect(db.readReadings).not.toHaveBeenCalled();
  });
});
