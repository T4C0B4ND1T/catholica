import { addDays } from '@/lib/dates';

/** Days of readings kept for offline use, starting today. */
export const OFFLINE_DAYS = 7;

/**
 * What the service worker saves for offline use: the coming week's readings (with reflections),
 * the Today, Mass and Bulletin pages, the Mass page for each day of the week (the Today page links to it),
 * and the newest bulletin with its PDF.
 */
export function offlineUrls(today: string, bulletinDate: string | null): string[] {
  const week = Array.from({ length: OFFLINE_DAYS }, (_, i) => addDays(today, i));
  return [
    ...week.map((d) => `/api/readings/${d}`),
    '/',
    '/mass',
    ...week.map((d) => `/mass?date=${d}`),
    '/bulletin',
    ...(bulletinDate ? [`/bulletin/${bulletinDate}`, `/api/bulletins/${bulletinDate}/pdf`] : []),
  ];
}
