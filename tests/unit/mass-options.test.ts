import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  bookmarkKey,
  bookmarkLabel,
  defaultMass,
  isBookmarkSection,
  massNames,
  massSections,
  sectionForKind,
} from '@/lib/mass-options';
import { fetchUsccb, parseUsccb } from '@/lib/sources/usccb';
import type { ReadingSection } from '@/lib/types';

vi.mock('server-only', () => ({}));

const fx = (name: string) => readFileSync(join(__dirname, '../fixtures/usccb', `${name}.html`), 'utf8');

/** Fetches a multi-Mass day from fixtures: `pages` maps a URL suffix to a fixture name. */
async function landing(date: string, pages: Record<string, string>): Promise<ReadingSection[]> {
  const r = await fetchUsccb(date, async (url) => {
    const hit = Object.entries(pages).find(([suffix]) => url.endsWith(suffix));
    if (!hit) throw new Error(`unexpected ${url}`);
    return fx(hit[1]);
  });
  return r.sections;
}

const christmas = () =>
  landing('2025-12-25', {
    '122525.cfm': 'christmas-2025-12-25',
    '-Vigil.cfm': 'christmas-2025-12-25-Vigil',
    '-Night.cfm': 'christmas-2025-12-25-Night',
    '-Dawn.cfm': 'christmas-2025-12-25-Dawn',
    '-Day.cfm': 'christmas-2025-12-25-Day',
  });

const johnBaptist = () =>
  landing('2026-06-24', {
    '062426.cfm': 'john-baptist-2026-06-24',
    '062426-Vigil': 'john-baptist-2026-06-24-Vigil',
    '062426-Day': 'john-baptist-2026-06-24-Day',
  });

const s = (kind: ReadingSection['kind'], title: string, mass?: string): ReadingSection => ({
  kind,
  title,
  citation: '',
  text: 'x',
  ...(mass ? { mass } : {}),
});

describe('defaultMass', () => {
  it('is "Mass during the Day" at Christmas, and the Mass tab Gospel is John 1, not the Vigil genealogy', async () => {
    const sections = await christmas();
    expect(massNames(sections)).toEqual(['Vigil Mass', 'Mass during the Night', 'Mass at Dawn', 'Mass during the Day']);
    expect(defaultMass(sections)).toBe('Mass during the Day');
    const gospel = sectionForKind(sections, 'gospel')!;
    expect(gospel.section.mass).toBe('Mass during the Day');
    expect(gospel.section.citation).toMatch(/^John 1:1-18/);
    expect(gospel.index).toBe(sections.length - 1);
  });

  it('is "Mass during the Day" for St John the Baptist too', async () => {
    const sections = await johnBaptist();
    expect(defaultMass(sections)).toBe('Mass during the Day');
    expect(sectionForKind(sections, 'reading1')?.section.mass).toBe('Mass during the Day');
  });

  it('falls back to the last Mass, and is null on a single-Mass day', () => {
    expect(defaultMass([s('gospel', 'Gospel', 'Vigil'), s('gospel', 'Gospel', 'Night')])).toBe('Night');
    expect(defaultMass([s('gospel', 'Gospel')])).toBeNull();
    expect(massNames([s('gospel', 'Gospel')])).toEqual([]);
  });
});

describe('massSections', () => {
  it('keeps only the chosen Mass, with day-wide indexes', async () => {
    const sections = await christmas();
    const vigil = massSections(sections, 'Vigil Mass');
    expect(vigil.every((m) => m.section.mass === 'Vigil Mass')).toBe(true);
    expect(vigil[0].index).toBe(0);
    const day = massSections(sections, 'Mass during the Day');
    expect(day[0].index).toBe(sections.length - day.length);
    expect(day.map((m) => m.label)).toEqual(['First Reading', 'Responsorial Psalm', 'Second Reading', 'Alleluia', 'Gospel']);
  });

  it('labels repeated kinds by title, never two identical pills (Easter Sunday)', () => {
    const r = parseUsccb(fx('easter-sunday-2026-04-05'), '2026-04-05');
    const labels = massSections(r.sections, null).map((m) => m.label);
    expect(labels).toEqual([
      'First Reading',
      'Responsorial Psalm',
      'Reading 2',
      'Or: Second Reading',
      'Sequence',
      'Alleluia',
      'Gospel',
      'Or: Gospel',
      'Or at afternoon or evening mass',
    ]);
  });

  it('labels the Easter Vigil readings by their own titles', () => {
    const r = parseUsccb(fx('easter-vigil-2026-04-04'), '2026-04-04');
    const labels = massSections(r.sections, null).map((m) => m.label);
    expect(new Set(labels.map((l) => l.toLowerCase())).size).toBe(labels.length);
    expect(labels).toContain('Reading III');
    expect(labels).not.toContain('Reading');
  });

  it('keeps Palm Sunday distinct: the procession Gospel is not the Gospel pill', () => {
    const r = parseUsccb(fx('palm-sunday-2026-03-29'), '2026-03-29');
    const labels = massSections(r.sections, null).map((m) => m.label);
    expect(labels[0]).toBe('At the Procession with Palms - Gospel');
    expect(labels).toContain('Gospel');
    expect(labels).toContain('Or: Gospel');
    expect(sectionForKind(r.sections, 'gospel')?.section.citation).toBe('Matthew 26:14—27:66');
  });

  it('numbers identical titles', () => {
    const labels = massSections([s('other', 'Option'), s('other', 'Option')], null).map((m) => m.label);
    expect(labels).toEqual(['Option', 'Option (2)']);
  });
});

describe('bookmark keys', () => {
  it('name the section and its Mass, and read back as a label', async () => {
    const sections = await christmas();
    const gospel = sectionForKind(sections, 'gospel')!;
    const key = bookmarkKey(gospel);
    expect(key).toBe(`${sections.length - 1}|Gospel, Mass during the Day`);
    expect(isBookmarkSection(key)).toBe(true);
    expect(bookmarkLabel(key)).toBe('Gospel, Mass during the Day');
  });

  it('read old kind-only bookmarks', () => {
    expect(isBookmarkSection('gospel')).toBe(true);
    expect(bookmarkLabel('gospel')).toBe('Gospel');
    expect(bookmarkLabel('reading1')).toBe('First Reading');
  });

  it('reject anything else', () => {
    for (const v of ['', 'constructor', 'toString', '|Gospel', '1|', 'x|Gospel', '1234|Gospel', '1|a\nb', ` 1|Gospel`, `1|${'x'.repeat(301)}`]) {
      expect(isBookmarkSection(v)).toBe(false);
    }
  });
});
