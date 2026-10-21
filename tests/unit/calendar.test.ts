import { describe, expect, it } from 'vitest';
import {
  baptismOfTheLord,
  comingSunday,
  easterSunday,
  firstSundayOfAdvent,
  liturgicalDay,
} from '@/lib/liturgical/calendar';

describe('anchor dates', () => {
  it.each([
    [2025, '2025-11-30'], [2026, '2026-11-29'], [2027, '2027-11-28'],
    [2028, '2028-12-03'], [2029, '2029-12-02'], [2030, '2030-12-01'],
  ])('firstSundayOfAdvent %i', (y, d) => expect(firstSundayOfAdvent(y)).toBe(d));
  it.each([
    [2025, '2025-04-20'], [2026, '2026-04-05'], [2027, '2027-03-28'],
    [2028, '2028-04-16'], [2029, '2029-04-01'], [2030, '2030-04-21'],
  ])('easterSunday %i', (y, d) => expect(easterSunday(y)).toBe(d));
  it.each([
    [2026, '2026-01-11'], [2029, '2029-01-08'], [2030, '2030-01-13'],
  ])('baptismOfTheLord %i', (y, d) => expect(baptismOfTheLord(y)).toBe(d));
});

describe('cycles', () => {
  it.each([
    ['2026-11-28', 'A', 'II'], ['2026-11-29', 'B', 'I'],
    ['2025-11-29', 'C', 'I'], ['2025-11-30', 'A', 'II'],
  ])('%s', (d, s, w) => {
    const day = liturgicalDay(d);
    expect([day.sundayCycle, day.weekdayCycle]).toEqual([s, w]);
  });
});

describe('seasons and colors', () => {
  it.each([
    ['2026-11-29', 'advent', 'violet'],
    ['2026-12-13', 'advent', 'rose'],
    ['2026-12-25', 'christmas', 'white'],
    ['2026-01-11', 'christmas', 'white'],
    ['2026-01-12', 'ordinary', 'green'],
    ['2026-02-18', 'lent', 'violet'],
    ['2026-03-15', 'lent', 'rose'],
    ['2026-03-29', 'lent', 'red'],
    ['2026-04-02', 'triduum', 'white'],
    ['2026-04-03', 'triduum', 'red'],
    ['2026-04-05', 'easter', 'white'],
    ['2026-05-24', 'easter', 'red'],
    ['2026-05-25', 'ordinary', 'green'],
  ])('%s', (d, season, color) => {
    const day = liturgicalDay(d);
    expect([day.season, day.color]).toEqual([season, color]);
  });
  it('flags Sundays', () => {
    expect(liturgicalDay('2026-10-25').isSunday).toBe(true);
    expect(liturgicalDay('2026-10-26').isSunday).toBe(false);
  });
});

describe('comingSunday', () => {
  it('returns next Sunday or the date itself', () => {
    expect(comingSunday('2026-10-21')).toBe('2026-10-25');
    expect(comingSunday('2026-10-25')).toBe('2026-10-25');
  });
});
