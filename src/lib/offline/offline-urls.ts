import { addDays } from '@/lib/dates';
import { comingSunday } from '@/lib/liturgical/calendar';
import { PRAYERS } from '@/data/prayers';

/** The service worker's cache. Keep in step with `CACHE` in public/sw.js. */
export const OFFLINE_CACHE = 'catholica-v1';

/** Forgets the saved Me page, so a signed-out phone never shows the signed-in one offline. */
export async function forgetSavedMePage(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(OFFLINE_CACHE);
  await cache.delete('/me', { ignoreSearch: true });
}

/** Days of readings kept for offline use, starting today: eight, so the coming Sunday is always among them. */
export const OFFLINE_DAYS = 8;

/**
 * What the service worker saves for offline use: the coming week's readings (with reflections),
 * the Today and Bulletin pages, the Mass page for each day of the week (bare `/mass` is today's, which the
 * service worker reads from `/mass?date=<today>`, so it is never saved on its own),
 * Sunday prep for the coming Sunday (and on a Sunday, the next one too), the prayer library, and the newest bulletin
 * with its PDF. The PDF route redirects to a signed storage URL; the service worker follows it
 * and saves the file under the stable `/api/bulletins/<date>/pdf` path.
 */
export function offlineUrls(today: string, bulletinDate: string | null): string[] {
  const week = Array.from({ length: OFFLINE_DAYS }, (_, i) => addDays(today, i));
  return [
    ...week.map((d) => `/api/readings/${d}`),
    '/',
    ...week.map((d) => `/mass?date=${d}`),
    ...[...new Set([comingSunday(today), comingSunday(addDays(today, 1))])].map((d) => `/sunday?date=${d}`),
    '/prayers',
    ...PRAYERS.map((p) => `/prayers/${p.slug}`),
    '/bulletin',
    ...(bulletinDate ? [`/bulletin/${bulletinDate}`, `/api/bulletins/${bulletinDate}/pdf`] : []),
  ];
}

/** What the last prefetch asked the service worker to save, so Settings can ask again. Set by <ServiceWorker>. */
export interface PrefetchRequest {
  type: 'prefetch';
  urls: string[];
  bulletinDate: string | null;
  assets: string[];
}
let lastPrefetch: PrefetchRequest | null = null;
export const rememberPrefetch = (r: PrefetchRequest) => void (lastPrefetch = r);
export const lastPrefetchRequest = () => lastPrefetch;

export interface OfflineStatus {
  /** Saved days of readings from today on, in order. */
  days: string[];
  /** True when the newest bulletin's PDF is saved. */
  bulletin: boolean;
}

/** What this phone has saved for offline use, read straight from the service worker's cache. */
export async function offlineStatus(today: string): Promise<OfflineStatus | null> {
  if (typeof caches === 'undefined' || !(await caches.has(OFFLINE_CACHE))) return null;
  const cache = await caches.open(OFFLINE_CACHE);
  const days: string[] = [];
  let bulletin = false;
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    const reading = /^\/api\/readings\/(\d{4}-\d{2}-\d{2})$/.exec(path);
    if (reading && reading[1] >= today) days.push(reading[1]);
    if (/^\/api\/bulletins\/[^/]+\/pdf$/.test(path)) bulletin = true;
  }
  return { days: days.sort(), bulletin };
}
