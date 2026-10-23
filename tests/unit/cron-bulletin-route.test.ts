import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ runBulletinJob: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/bulletins', () => ({
  bulletinsMissingSummary: vi.fn(),
  dropStoredPdf: vi.fn(),
  hasBulletin: vi.fn(),
  newestBulletinDate: vi.fn(),
  saveBulletin: vi.fn(),
  saveBulletinSummary: vi.fn(),
  storedPdfsBefore: vi.fn(),
}));
vi.mock('@/lib/ai/writer', () => ({ summarizeBulletin: vi.fn() }));
vi.mock('@/lib/db/jobs', () => ({ logRun: vi.fn() }));
vi.mock('@/lib/jobs/alert', () => ({ sendAlert: vi.fn() }));
vi.mock('@/lib/sources/bulletins', () => ({ bulletinUrl: vi.fn(), extractPdfText: vi.fn(), fetchBulletinPdf: vi.fn() }));
vi.mock('@/lib/jobs/bulletin-job', () => ({ runBulletinJob: h.runBulletinJob }));

import { GET } from '@/app/api/cron/bulletin/route';

const call = () =>
  GET(new Request('http://x/api/cron/bulletin', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));

beforeEach(() => {
  process.env.CRON_SECRET = 'test-secret';
  h.runBulletinJob.mockReset();
});

describe('GET /api/cron/bulletin', () => {
  it('is 401 without the secret', async () => {
    expect((await GET(new Request('http://x/api/cron/bulletin'))).status).toBe(401);
    expect(h.runBulletinJob).not.toHaveBeenCalled();
  });

  it('is 200 with the JSON result when the job is ok', async () => {
    h.runBulletinJob.mockResolvedValue({ added: ['2026-10-18'], failures: 0, status: 'ok' });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ added: ['2026-10-18'], failures: 0, status: 'ok' });
  });

  it('is 500 with the JSON result on a database outage or host-down, so the cron dashboard shows it', async () => {
    h.runBulletinJob.mockResolvedValue({ added: [], failures: 3, status: 'error' });
    const res = await call();
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toMatch(/json/);
    expect(await res.json()).toEqual({ added: [], failures: 3, status: 'error' });
  });
});
