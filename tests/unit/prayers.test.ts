import { describe, expect, it } from 'vitest';
import { MYSTERIES, PRAYERS, mysteriesFor, prayerBySlug, prayerForName, prayerParagraphs } from '@/data/prayers';
import { offlineUrls } from '@/lib/offline/offline-urls';

describe('prayers', () => {
  it('has unique slugs and text for every prayer but the Rosary guide', () => {
    expect(new Set(PRAYERS.map((p) => p.slug)).size).toBe(PRAYERS.length);
    for (const p of PRAYERS) if (p.slug !== 'rosary') expect(p.text.trim()).not.toBe('');
  });

  it('matches the default routines and loose names to library prayers', () => {
    expect(prayerForName('Morning Offering')?.slug).toBe('morning-offering');
    expect(prayerForName('Angelus')?.slug).toBe('angelus');
    expect(prayerForName('Rosary')?.slug).toBe('rosary');
    expect(prayerForName('Examen')?.slug).toBe('examen');
    expect(prayerForName('daily examen')?.slug).toBe('examen');
    expect(prayerForName('St. Michael')?.slug).toBe('st-michael');
    expect(prayerForName('Prayer to Saint Michael')?.slug).toBe('st-michael');
    expect(prayerForName('Walk the dog')).toBeUndefined();
    expect(prayerForName('')).toBeUndefined();
  });

  it('gives the customary mysteries for each weekday', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(mysteriesFor)).toEqual([
      'glorious', 'joyful', 'sorrowful', 'glorious', 'luminous', 'sorrowful', 'joyful',
    ]);
    for (const set of Object.values(MYSTERIES)) expect(set.mysteries).toHaveLength(5);
  });

  it('runs prose lines together but keeps versicles, responses and verse prayers on their own lines', () => {
    const angelus = prayerParagraphs(prayerBySlug('angelus')!);
    expect(angelus[0].split('\n')).toEqual([
      'V. The Angel of the Lord declared unto Mary,',
      'R. And she conceived of the Holy Spirit.',
      'Hail Mary…',
    ]);
    expect(angelus.at(-1)).not.toContain('\n');
    expect(prayerParagraphs(prayerBySlug('our-father')!)[0]).not.toContain('\n');
    expect(prayerParagraphs(prayerBySlug('anima-christi')!)[0].split('\n')).toHaveLength(12);
  });

  it('saves the library for offline use', () => {
    const urls = offlineUrls('2026-10-21', null);
    expect(urls).toContain('/prayers');
    expect(urls).toContain('/prayers/rosary');
  });
});
