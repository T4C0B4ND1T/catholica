import { addDays } from '@/lib/dates';

/** The service worker's cache. Keep in step with `CACHE` in public/sw.js. */
export const OFFLINE_CACHE = 'catholica-v1';

/** Forgets the saved Me page, so a signed-out phone never shows the signed-in one offline. */
export async function forgetSavedMePage(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(OFFLINE_CACHE);
  await cache.delete('/me', { ignoreSearch: true });
}

/** Days of readings kept for offline use, starting today. */
export const OFFLINE_DAYS = 7;

/**
 * What the service worker saves for offline use: the coming week's readings (with reflections),
 * the Today and Bulletin pages, the Mass page for each day of the week (bare `/mass` is today's, which the
 * service worker reads from `/mass?date=<today>`, so it is never saved on its own),
 * and the newest bulletin with its PDF. The PDF route redirects to a signed storage URL; the service worker follows it
 * and saves the file under the stable `/api/bulletins/<date>/pdf` path.
 */
export function offlineUrls(today: string, bulletinDate: string | null): string[] {
  const week = Array.from({ length: OFFLINE_DAYS }, (_, i) => addDays(today, i));
  return [
    ...week.map((d) => `/api/readings/${d}`),
    '/',
    ...week.map((d) => `/mass?date=${d}`),
    '/bulletin',
    ...(bulletinDate ? [`/bulletin/${bulletinDate}`, `/api/bulletins/${bulletinDate}/pdf`] : []),
  ];
}
