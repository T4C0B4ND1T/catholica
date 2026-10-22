import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ getBulletinPdfUrl: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/bulletins', () => ({ getBulletinPdfUrl: h.getBulletinPdfUrl }));

import { GET } from '@/app/api/bulletins/[date]/pdf/route';

const call = (date: string) =>
  GET(new Request(`http://x/api/bulletins/${date}/pdf`), { params: Promise.resolve({ date }) });

beforeEach(() => {
  h.getBulletinPdfUrl.mockReset();
});

describe('GET /api/bulletins/[date]/pdf', () => {
  it('redirects to a one-hour signed URL that is never cached', async () => {
    const signed = 'https://abc.supabase.co/storage/v1/object/sign/bulletins/2026-10-18.pdf?token=t';
    h.getBulletinPdfUrl.mockResolvedValue(signed);
    const res = await call('2026-10-18');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(signed);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(h.getBulletinPdfUrl).toHaveBeenCalledWith('2026-10-18', 3600);
  });

  it('is 400 for a bad date, without a lookup', async () => {
    expect((await call('nope')).status).toBe(400);
    expect(h.getBulletinPdfUrl).not.toHaveBeenCalled();
  });

  it('is 404 for an unknown date or file', async () => {
    h.getBulletinPdfUrl.mockResolvedValue(null);
    const res = await call('2026-10-18');
    expect(res.status).toBe(404);
    expect(res.headers.get('location')).toBeNull();
  });

  it('is an uncached 503 when the lookup fails', async () => {
    h.getBulletinPdfUrl.mockRejectedValue(new Error('db down'));
    const res = await call('2026-10-18');
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
