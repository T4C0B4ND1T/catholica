import type { LitColor, LiturgicalDay, Season } from '../types';
import { addDays, dayOfWeek } from '../dates';

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Sunday on or before `date`. */
function sundayOnOrBefore(date: string): string {
  return addDays(date, -dayOfWeek(date));
}

export function firstSundayOfAdvent(year: number): string {
  // Fourth Sunday of Advent is the Sunday on or before Dec 24.
  return addDays(sundayOnOrBefore(iso(year, 12, 24)), -21);
}

/** Anonymous Gregorian algorithm. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

/** US: Epiphany is the Sunday Jan 2-8; Baptism is the next Sunday, or the Monday after if Epiphany is Jan 7 or 8. */
export function baptismOfTheLord(year: number): string {
  let epiphany = iso(year, 1, 2);
  epiphany = addDays(epiphany, (7 - dayOfWeek(epiphany)) % 7);
  const day = Number(epiphany.slice(8));
  return addDays(epiphany, day >= 7 ? 1 : 7);
}

function seasonOf(date: string, year: number): Season {
  const easter = easterSunday(year);
  if (date >= addDays(easter, -3) && date <= addDays(easter, -1)) return 'triduum';
  if (date >= addDays(easter, -46) && date < addDays(easter, -3)) return 'lent';
  if (date >= easter && date <= addDays(easter, 49)) return 'easter';
  if (date >= firstSundayOfAdvent(year) && date <= iso(year, 12, 24)) return 'advent';
  if (date >= iso(year, 12, 25) || date <= baptismOfTheLord(year)) return 'christmas';
  return 'ordinary';
}

const SEASON_COLOR: Record<Season, LitColor> = {
  advent: 'violet',
  lent: 'violet',
  christmas: 'white',
  easter: 'white',
  triduum: 'white',
  ordinary: 'green',
};

function colorOf(date: string, season: Season, year: number): LitColor {
  const easter = easterSunday(year);
  if (date === addDays(easter, -7) || date === addDays(easter, -2) || date === addDays(easter, 49)) {
    return 'red';
  }
  if (date === addDays(firstSundayOfAdvent(year), 14) || date === addDays(easter, -21)) {
    return 'rose';
  }
  return SEASON_COLOR[season];
}

export function liturgicalDay(date: string): LiturgicalDay {
  const year = Number(date.slice(0, 4));
  const season = seasonOf(date, year);
  // Liturgical year is named for the calendar year in which its Advent begins.
  const litYear = date >= firstSundayOfAdvent(year) ? year : year - 1;
  const sundayCycle = (['A', 'B', 'C'] as const)[litYear % 3];
  return {
    date,
    season,
    color: colorOf(date, season, year),
    sundayCycle,
    weekdayCycle: litYear % 2 === 0 ? 'I' : 'II',
    isSunday: dayOfWeek(date) === 0,
  };
}

/** The date itself if a Sunday, else the next Sunday. */
export function comingSunday(date: string): string {
  return addDays(date, (7 - dayOfWeek(date)) % 7);
}
