import { describe, expect, it } from 'vitest';
import { ORDER_OF_MASS_STEPS } from '@/data/order-of-mass';
import { dayRank, massDayPlan } from '@/lib/liturgical/mass-day';
import type { DailyReadings, ReadingKind } from '@/lib/types';

const step = (id: string) => ORDER_OF_MASS_STEPS.find((s) => s.id === id)!;

function readings(date: string, feast: string, kinds: ReadingKind[] = ['reading1', 'psalm', 'alleluia', 'gospel']): DailyReadings {
  return {
    date,
    feast,
    sections: kinds.map((kind) => ({ kind, title: kind, citation: '', text: '' })),
    sourceUrl: 'u',
    fetchedAt: '2026-10-21T09:00:00Z',
  } as DailyReadings;
}

describe('dayRank', () => {
  it('tells Sundays, solemnities and weekdays from the date and USCCB title', () => {
    expect(dayRank('2026-10-25', 'Thirtieth Sunday in Ordinary Time')).toBe('sunday');
    expect(dayRank('2026-10-21', 'Wednesday of the Twenty-ninth Week in Ordinary Time')).toBe('weekday');
    expect(dayRank('2026-12-08', 'The Immaculate Conception of the Blessed Virgin Mary')).toBe('solemnity');
    expect(dayRank('2026-11-22', 'Our Lord Jesus Christ, King of the Universe')).toBe('solemnity');
    expect(dayRank('2027-02-17', 'Ash Wednesday')).toBe('weekday');
    expect(dayRank('2026-10-17', 'Saint Ignatius of Antioch, Bishop and Martyr')).toBe('unknown');
  });
});

describe('massDayPlan', () => {
  it('ordinary Sunday: Gloria, Creed and second reading', () => {
    const { plan, banner } = massDayPlan('2026-10-25', readings('2026-10-25', 'Thirtieth Sunday in Ordinary Time', ['reading1', 'psalm', 'reading2', 'alleluia', 'gospel']));
    expect(banner).toBeNull();
    expect(plan(step('gloria')).state).toBe('show');
    expect(plan(step('profession-of-faith')).state).toBe('show');
    expect(plan(step('second-reading')).state).toBe('show');
  });

  it('Sunday of Advent: no Gloria', () => {
    const { plan } = massDayPlan('2026-11-29', readings('2026-11-29', 'First Sunday of Advent'));
    expect(plan(step('gloria'))).toMatchObject({ state: 'omit', note: 'Not sung on Sundays of Advent.' });
    expect(plan(step('profession-of-faith')).state).toBe('show');
  });

  it('weekday: no Gloria, Creed or second reading', () => {
    const { plan } = massDayPlan('2026-10-21', readings('2026-10-21', 'Wednesday of the Twenty-ninth Week in Ordinary Time'));
    expect(plan(step('gloria')).state).toBe('omit');
    expect(plan(step('profession-of-faith')).state).toBe('omit');
    expect(plan(step('second-reading'))).toMatchObject({ state: 'omit', note: 'No second reading today.' });
  });

  it('memorial or feast: the Gloria is marked as possible', () => {
    const { plan } = massDayPlan('2026-10-17', readings('2026-10-17', 'Saint Ignatius of Antioch, Bishop and Martyr'));
    expect(plan(step('gloria')).state).toBe('maybe');
  });

  it('solemnity in Advent keeps the Gloria and Creed', () => {
    const { plan } = massDayPlan('2026-12-08', readings('2026-12-08', 'The Immaculate Conception of the Blessed Virgin Mary'));
    expect(plan(step('gloria')).state).toBe('show');
    expect(plan(step('profession-of-faith')).state).toBe('show');
  });

  it('Lent swaps in the Lenten acclamation', () => {
    const p = massDayPlan('2027-02-21', readings('2027-02-21', 'First Sunday of Lent')).plan(step('gospel-acclamation'));
    expect(p.step?.dialogue[0].text).toMatch(/Praise to you, Lord Jesus Christ/);
    expect(JSON.stringify(p.step)).not.toMatch(/Alleluia/);
  });

  it('without readings a weekday still drops the second reading', () => {
    const { plan } = massDayPlan('2026-10-22', null);
    expect(plan(step('second-reading')).state).toBe('maybe');
    expect(massDayPlan('2026-10-25', null).plan(step('second-reading')).state).toBe('show');
  });

  it('Triduum and Easter octave', () => {
    expect(massDayPlan('2027-03-26', null).banner).toMatch(/Good Friday/);
    expect(massDayPlan('2027-03-29', readings('2027-03-29', 'Monday within the Octave of Easter')).plan(step('gloria')).state).toBe('show');
    expect(massDayPlan('2027-03-28', null).plan(step('dismissal')).note).toMatch(/alleluia, alleluia/);
  });
});
