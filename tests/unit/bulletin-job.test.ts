import { describe, expect, it, vi } from 'vitest';
import { candidateSundays, runBulletinJob, type BulletinJobDeps } from '@/lib/jobs/bulletin-job';

const BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
// 12:00 Chicago (CDT) = 17:00 UTC
const MON = new Date('2026-10-19T17:00:00Z');
const TUE = new Date('2026-10-20T17:00:00Z');
const SUN = new Date('2026-10-18T17:00:00Z');

function setup(over: Partial<BulletinJobDeps> = {}, saved: string[] = []) {
  const db = new Set(saved);
  return {
    fetchPdf: vi.fn(async () => BYTES as Uint8Array | null),
    urlFor: (d: string) => `u/${d}`,
    extractText: vi.fn(async () => ({ text: 't', pageCount: 4 })),
    hasBulletin: vi.fn(async (d: string) => db.has(d)),
    saveBulletin: vi.fn(async (m: { sundayDate: string }) => void db.add(m.sundayDate)),
    newestBulletinDate: vi.fn(async () => [...db].sort().at(-1) ?? null),
    logRun: vi.fn(async () => {}),
    alert: vi.fn(async () => {}),
    now: SUN,
    ...over,
  } satisfies BulletinJobDeps;
}

describe('candidateSundays', () => {
  it('spans 8 weeks back through the current Sunday', () => {
    const c = candidateSundays('2026-10-19');
    expect(c[0]).toBe('2026-08-23');
    expect(c.at(-1)).toBe('2026-10-18');
    expect(c).toHaveLength(9);
  });
  it('adds the coming Sunday Thu-Sat only', () => {
    expect(candidateSundays('2026-10-22').at(-1)).toBe('2026-10-25');
    expect(candidateSundays('2026-10-21').at(-1)).toBe('2026-10-18');
  });
  it('honours since, aligned up to a Sunday', () => {
    expect(candidateSundays('2026-10-18', '2026-10-05')).toEqual(['2026-10-11', '2026-10-18']);
  });
});

describe('runBulletinJob', () => {
  it('downloads only dates not saved', async () => {
    const deps = setup({ since: '2026-10-04' }, ['2026-10-04', '2026-10-11']);
    const res = await runBulletinJob(deps);
    expect(res.added).toEqual(['2026-10-18']);
    expect(deps.fetchPdf).toHaveBeenCalledTimes(1);
    expect(deps.fetchPdf).toHaveBeenCalledWith('2026-10-18');
    expect(deps.saveBulletin).toHaveBeenCalledWith(
      { sundayDate: '2026-10-18', sourceUrl: 'u/2026-10-18', pageCount: 4, text: 't' },
      BYTES,
    );
    expect(deps.alert).not.toHaveBeenCalled();
    expect(deps.logRun).toHaveBeenCalledWith('bulletin', 'ok', expect.stringContaining('added 1'));
  });

  it('logs a download error and continues', async () => {
    const deps = setup({
      since: '2026-10-04',
      fetchPdf: vi.fn(async (d: string) => {
        if (d === '2026-10-11') throw new Error('boom');
        return BYTES;
      }),
    });
    const res = await runBulletinJob(deps);
    expect(res.added).toEqual(['2026-10-04', '2026-10-18']);
    expect(deps.logRun).toHaveBeenCalledWith('bulletin', 'ok', expect.stringContaining('2026-10-11: boom'));
  });

  it('treats an unposted date as normal', async () => {
    const deps = setup({ since: '2026-10-18', fetchPdf: vi.fn(async () => null) });
    const res = await runBulletinJob(deps);
    expect(res.added).toEqual([]);
    expect(deps.logRun).toHaveBeenCalledWith('bulletin', 'ok', expect.any(String));
  });

  it('alerts on Monday when the newest bulletin is older than the last Sunday', async () => {
    const deps = setup({ now: MON, since: '2026-10-11', fetchPdf: vi.fn(async () => null) }, ['2026-10-11']);
    await runBulletinJob(deps);
    expect(deps.alert).toHaveBeenCalledTimes(1);
  });

  it('does not alert on Tuesday with the same state (Monday rule only)', async () => {
    const deps = setup({ now: TUE, since: '2026-10-11', fetchPdf: vi.fn(async () => null) }, ['2026-10-11']);
    await runBulletinJob(deps);
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('does not alert on Sunday with the same state', async () => {
    const deps = setup({ now: SUN, since: '2026-10-11', fetchPdf: vi.fn(async () => null) }, ['2026-10-11']);
    await runBulletinJob(deps);
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('does not alert on Monday when the Sunday bulletin is saved', async () => {
    const deps = setup({ now: MON, since: '2026-10-11' }, ['2026-10-11']);
    await runBulletinJob(deps);
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('logs error and alerts when every probe fails', async () => {
    const deps = setup({ since: '2026-10-04', fetchPdf: vi.fn(async () => { throw new Error('down'); }) });
    const res = await runBulletinJob(deps);
    expect(res.added).toEqual([]);
    expect(deps.logRun).toHaveBeenCalledWith('bulletin', 'error', expect.stringContaining('down'));
    expect(deps.alert).toHaveBeenCalledTimes(1);
  });

  it('pauses after each download attempt when asked', async () => {
    const sleep = vi.fn(async () => {});
    const deps = setup({ since: '2026-10-04', pauseMs: 2000, sleep });
    await runBulletinJob(deps);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('saves without text when extraction fails', async () => {
    const deps = setup({ since: '2026-10-18', extractText: vi.fn(async () => { throw new Error('bad pdf'); }) });
    const res = await runBulletinJob(deps);
    expect(res.added).toEqual(['2026-10-18']);
    expect(deps.saveBulletin).toHaveBeenCalledWith(expect.objectContaining({ text: null, pageCount: 0 }), BYTES);
  });

  it('reports a database outage as an error, not a missing bulletin', async () => {
    const deps = setup({
      now: MON,
      since: '2026-10-11',
      hasBulletin: vi.fn(async () => { throw new Error('db down'); }),
      newestBulletinDate: vi.fn(async () => { throw new Error('db down'); }),
    });
    const res = await runBulletinJob(deps);
    expect(res.failures).toBeGreaterThan(0);
    expect(deps.alert).toHaveBeenCalledTimes(1);
    expect(deps.alert).toHaveBeenCalledWith(expect.stringContaining('database'), expect.any(String));
    expect(deps.logRun).toHaveBeenCalledWith('bulletin', 'error', expect.stringContaining('db down'));
  });

  it('reports status error for a database outage or an unreachable host, ok otherwise', async () => {
    const db = setup({ since: '2026-10-11', hasBulletin: vi.fn(async () => { throw new Error('db down'); }) });
    expect((await runBulletinJob(db)).status).toBe('error');
    const host = setup({ since: '2026-10-04', fetchPdf: vi.fn(async () => { throw new Error('down'); }) });
    expect((await runBulletinJob(host)).status).toBe('error');
    expect((await runBulletinJob(setup({ since: '2026-10-04' }))).status).toBe('ok');
  });

  it('returns the failure count', async () => {
    const deps = setup({ since: '2026-10-04', fetchPdf: vi.fn(async (d: string) => { if (d === '2026-10-11') throw new Error('x'); return BYTES; }) });
    expect((await runBulletinJob(deps)).failures).toBe(1);
  });
});
