import { usccbSlug } from '@/lib/dates';

/** The USCCB daily-readings page for a `YYYY-MM-DD` date. */
export function usccbUrl(date: string): string {
  return `https://bible.usccb.org/bible/readings/${usccbSlug(date)}.cfm`;
}
