import { describe, expect, it } from 'vitest';
import { offlineUrls } from '@/lib/offline/offline-urls';

describe('offlineUrls', () => {
  it('covers seven days of readings from today, across a month end', () => {
    const urls = offlineUrls('2026-10-28', null);
    expect(urls.filter((u) => u.startsWith('/api/readings/'))).toEqual([
      '/api/readings/2026-10-28',
      '/api/readings/2026-10-29',
      '/api/readings/2026-10-30',
      '/api/readings/2026-10-31',
      '/api/readings/2026-11-01',
      '/api/readings/2026-11-02',
      '/api/readings/2026-11-03',
    ]);
  });

  it('includes the app pages and the Mass page for each day', () => {
    const urls = offlineUrls('2026-10-21', null);
    expect(urls).toContain('/');
    expect(urls).toContain('/mass');
    expect(urls).toContain('/bulletin');
    expect(urls).toContain('/mass?date=2026-10-21');
    expect(urls).toContain('/mass?date=2026-10-27');
    expect(urls).not.toContain('/mass?date=2026-10-28');
  });

  it('adds the newest bulletin and its PDF only when one exists', () => {
    expect(offlineUrls('2026-10-21', '2026-10-18')).toEqual(
      expect.arrayContaining(['/bulletin/2026-10-18', '/api/bulletins/2026-10-18/pdf']),
    );
    expect(offlineUrls('2026-10-21', null).some((u) => u.includes('/api/bulletins/'))).toBe(false);
  });

  it('never lists personal, cron or auth paths', () => {
    expect(offlineUrls('2026-10-21', '2026-10-18').some((u) => /^\/(api\/me|api\/cron|auth)\//.test(u))).toBe(false);
  });
});
