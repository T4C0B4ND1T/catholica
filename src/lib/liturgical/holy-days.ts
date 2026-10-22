import { addDays, dayOfWeek } from '@/lib/dates';

/**
 * The holy day of obligation (besides Sundays) on a date in the United States, or null.
 * Jan 1, Aug 15 and Nov 1 lose the obligation on a Saturday or Monday. Dec 8 keeps it on any weekday, but on a
 * Sunday it moves to Dec 9 without the obligation. Ascension is taken as moved to Sunday, as in most US provinces
 * (including New Orleans); a province that keeps Ascension Thursday is not covered.
 */
export function holyDayOfObligation(date: string): string | null {
  const md = date.slice(5);
  const dow = dayOfWeek(date);
  if (dow === 0) return null;
  const abrogable = dow === 1 || dow === 6;
  if (md === '01-01') return abrogable ? null : 'Mary, the Holy Mother of God';
  if (md === '08-15') return abrogable ? null : 'The Assumption of the Blessed Virgin Mary';
  if (md === '11-01') return abrogable ? null : 'All Saints';
  if (md === '12-08') return 'The Immaculate Conception of the Blessed Virgin Mary';
  if (md === '12-25') return 'The Nativity of the Lord (Christmas)';
  return null;
}

/** The first weekday holy day of obligation from `today` through `days` later, or null. */
export function upcomingHolyDay(today: string, days = 7): { date: string; name: string } | null {
  for (let i = 0; i <= days; i++) {
    const date = addDays(today, i);
    const name = holyDayOfObligation(date);
    if (name) return { date, name };
  }
  return null;
}
