import { describe, expect, it } from 'vitest';
import { FIXED_CELEBRATIONS } from '@/data/saints';
import { holyDayOfObligation, upcomingHolyDay } from '@/lib/liturgical/holy-days';
import { celebrationsOn, saintsOfDay } from '@/lib/liturgical/saints';

describe('saintsOfDay', () => {
  it('names an optional memorial the weekday title leaves out', () => {
    expect(saintsOfDay('2026-10-22', 'Thursday of the Twenty-ninth Week in Ordinary Time')).toEqual([
      { name: 'St. John Paul II', rank: 'O', label: 'Optional memorial' },
    ]);
  });

  it('skips a celebration the title already names', () => {
    expect(saintsOfDay('2026-10-17', 'Memorial of Saint Ignatius of Antioch, Bishop and Martyr')).toEqual([]);
    expect(saintsOfDay('2026-10-07', 'Memorial of Our Lady of the Rosary')).toEqual([]);
  });

  it('shows nothing on Sundays or from Palm Sunday through the Easter Octave', () => {
    expect(saintsOfDay('2026-10-18', 'Twenty-ninth Sunday in Ordinary Time')).toEqual([]);
    // Easter 2027 is March 28: St. Turibius (Mar 23) falls in Holy Week.
    expect(saintsOfDay('2027-03-23', 'Tuesday of Holy Week')).toEqual([]);
  });

  it('calls memorials in Lent and Dec 17-24 commemorations', () => {
    expect(saintsOfDay('2027-03-17', 'Wednesday of the Fourth Week of Lent')[0]).toMatchObject({
      name: 'St. Patrick',
      label: 'Commemoration',
    });
    expect(saintsOfDay('2026-12-21', 'December 21')[0].label).toBe('Commemoration');
  });

  it('adds Easter-tied celebrations', () => {
    // Pentecost 2026 is May 24.
    expect(celebrationsOn('2026-05-25').map((c) => c.name)).toContain('The Blessed Virgin Mary, Mother of the Church');
    expect(celebrationsOn('2026-06-13').map((c) => c.name)).toContain('The Immaculate Heart of the Blessed Virgin Mary');
  });

  it('keys every fixed date as a real MM-DD', () => {
    for (const k of Object.keys(FIXED_CELEBRATIONS)) expect(new Date(`2028-${k}T12:00:00Z`).toISOString().slice(5, 10)).toBe(k);
  });
});

describe('holy days of obligation', () => {
  it('lifts Jan 1, Aug 15 and Nov 1 on a Saturday or Monday', () => {
    expect(holyDayOfObligation('2027-01-01')).toBe('Mary, the Holy Mother of God'); // Friday
    expect(holyDayOfObligation('2028-01-01')).toBeNull(); // Saturday
    expect(holyDayOfObligation('2027-11-01')).toBeNull(); // Monday
    expect(holyDayOfObligation('2028-11-01')).toBe('All Saints'); // Wednesday
  });

  it('keeps Dec 8 on a Saturday or Monday, not when it falls on Sunday', () => {
    expect(holyDayOfObligation('2029-12-08')).not.toBeNull(); // Saturday
    expect(holyDayOfObligation('2030-12-08')).toBeNull(); // Sunday
    expect(holyDayOfObligation('2030-12-09')).toBeNull();
  });

  it('finds the next one within a week, skipping Sundays', () => {
    expect(upcomingHolyDay('2026-12-02')).toEqual({ date: '2026-12-08', name: 'The Immaculate Conception of the Blessed Virgin Mary' });
    expect(upcomingHolyDay('2026-10-26')).toBeNull(); // Nov 1, 2026 is a Sunday
    expect(upcomingHolyDay('2026-11-20')).toBeNull();
  });
});
