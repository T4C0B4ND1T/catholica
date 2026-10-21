import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { describe, expect, it, vi } from 'vitest';
import { fetchUsccb, parseMassLinks, parseUsccb, usccbUrl } from '@/lib/sources/usccb';

vi.mock('server-only', () => ({}));

const fx = (name: string) => readFileSync(join(__dirname, '../fixtures/usccb', `${name}.html`), 'utf8');
const headingCount = (html: string) => cheerio.load(html)('h3.name').length;

describe('usccbUrl', () => {
  it('builds the daily readings URL', () => {
    expect(usccbUrl('2026-10-25')).toBe('https://bible.usccb.org/bible/readings/102526.cfm');
  });
});

describe('parseUsccb', () => {
  it('parses a Sunday', () => {
    const r = parseUsccb(fx('sunday-2026-10-25'), '2026-10-25');
    expect(r.feast).toBe('Thirtieth Sunday in Ordinary Time');
    expect(r.lectionary).toMatch(/^\d+$/);
    expect(r.lectionary).toBe('148');
    expect(r.sections.map((s) => s.kind)).toEqual(['reading1', 'psalm', 'reading2', 'alleluia', 'gospel']);
    expect(r.sourceUrl).toBe('https://bible.usccb.org/bible/readings/102526.cfm');
    const gospel = r.sections[4];
    expect(gospel.citation).toBe('Matthew 22:34-40');
    expect(gospel.text.startsWith('When the Pharisees heard that Jesus had silenced the Sadducees,')).toBe(true);
  });

  it('has no second reading on a weekday', () => {
    const r = parseUsccb(fx('weekday-2026-10-21'), '2026-10-21');
    expect(r.sections.some((s) => s.kind === 'reading2')).toBe(false);
    expect(r.sections.map((s) => s.kind)).toEqual(['reading1', 'psalm', 'alleluia', 'gospel']);
  });

  it('keeps every heading of the Easter Vigil as its own section in page order', () => {
    const html = fx('easter-vigil-2026-04-04');
    const r = parseUsccb(html, '2026-04-04');
    expect(r.sections).toHaveLength(headingCount(html));
    const titles = r.sections.map((s) => s.title);
    expect(titles.slice(0, 3)).toEqual(['Reading I', 'Or', 'Responsorial Psalm']);
    expect(titles.at(-1)).toBe('Gospel');
    expect(r.sections.find((s) => s.title === 'Epistle')?.kind).toBe('reading2');
  });

  it('maps the Easter Vigil kinds: only the Epistle is reading2, alternates follow the section before', () => {
    const r = parseUsccb(fx('easter-vigil-2026-04-04'), '2026-04-04');
    const reading2 = r.sections.filter((s) => s.kind === 'reading2');
    expect(reading2.map((s) => s.title)).toEqual(['Epistle']);
    expect(r.sections.find((s) => s.title === 'Reading II')?.kind).toBe('other');
    expect(r.sections[0].kind).toBe('reading1');
    expect(r.sections[1]).toMatchObject({ title: 'Or', kind: 'reading1' });
    expect(r.sections[3]).toMatchObject({ title: 'or', kind: 'psalm' });
  });

  it('throws on a block with a title but an empty body', () => {
    const html = '<div class="b-verse"><h3 class="name">Gospel</h3><div class="address">Mt 1</div><div class="content-body"><p>&nbsp;</p></div></div>';
    expect(() => parseUsccb(html, '2026-10-25')).toThrow(/empty body/);
  });

  it('cleans every section: no tags, no nbsp, psalm line breaks kept as newlines', () => {
    for (const name of ['sunday-2026-10-25', 'weekday-2026-10-21', 'easter-vigil-2026-04-04', 'christmas-2025-12-25-Day']) {
      const r = parseUsccb(fx(name), '2026-01-01');
      for (const s of r.sections) {
        expect(s.text).not.toMatch(/<[a-z/][^>]*>/i);
        expect(s.text).not.toContain('&nbsp;');
        expect(s.text).not.toContain(' ');
        expect(s.text).not.toMatch(/&[a-z]+;/);
        expect(s.text).toBe(s.text.trim());
        expect(s.text.length).toBeGreaterThan(0);
        expect(s.text).not.toMatch(/[ \t]+\n/);
      }
    }
    const psalm = parseUsccb(fx('sunday-2026-10-25'), '2026-10-25').sections[1];
    expect(psalm.text.split('\n').length).toBeGreaterThan(5);
    expect(psalm.text.startsWith('R. (2) I love you, Lord, my strength.\nI love you, O LORD, my strength,')).toBe(true);
  });

  it('returns no sections for the Christmas landing page', () => {
    const r = parseUsccb(fx('christmas-2025-12-25'), '2025-12-25');
    expect(r.sections).toEqual([]);
    expect(r.feast).toBe('The Nativity of the Lord (Christmas)');
    expect(r.lectionary).toBe('13, 14, 15, 16');
  });
});

describe('parseMassLinks', () => {
  it('lists the Christmas Masses in page order', () => {
    expect(parseMassLinks(fx('christmas-2025-12-25'))).toEqual([
      { name: 'Vigil Mass', url: 'https://bible.usccb.org/bible/readings/122525-Vigil.cfm' },
      { name: 'Mass during the Night', url: 'https://bible.usccb.org/bible/readings/122525-Night.cfm' },
      { name: 'Mass at Dawn', url: 'https://bible.usccb.org/bible/readings/122525-Dawn.cfm' },
      { name: 'Mass during the Day', url: 'https://bible.usccb.org/bible/readings/122525-Day.cfm' },
    ]);
  });
  it('is empty for an ordinary page', () => {
    expect(parseMassLinks(fx('sunday-2026-10-25'))).toEqual([]);
  });
});

describe('fetchUsccb', () => {
  const pages: Record<string, string> = {
    'https://bible.usccb.org/bible/readings/102526.cfm': fx('sunday-2026-10-25'),
    'https://bible.usccb.org/bible/readings/122525.cfm': fx('christmas-2025-12-25'),
    'https://bible.usccb.org/bible/readings/122525-Vigil.cfm': fx('christmas-2025-12-25-Vigil'),
    'https://bible.usccb.org/bible/readings/122525-Night.cfm': fx('christmas-2025-12-25-Night'),
    'https://bible.usccb.org/bible/readings/122525-Dawn.cfm': fx('christmas-2025-12-25-Dawn'),
    'https://bible.usccb.org/bible/readings/122525-Day.cfm': fx('christmas-2025-12-25-Day'),
  };
  const fetchText = async (url: string) => {
    if (!(url in pages)) throw new Error(`unexpected ${url}`);
    return pages[url];
  };

  it('stamps fetchedAt on a normal page', async () => {
    const r = await fetchUsccb('2026-10-25', fetchText);
    expect(r.sections).toHaveLength(5);
    expect(new Date(r.fetchedAt).toString()).not.toBe('Invalid Date');
  });

  it('combines every Christmas Mass in page order with Mass-prefixed titles', async () => {
    const r = await fetchUsccb('2025-12-25', fetchText);
    const counts = ['Vigil', 'Night', 'Dawn', 'Day'].map((m) => headingCount(fx(`christmas-2025-12-25-${m}`)));
    expect(r.sections).toHaveLength(counts.reduce((a, b) => a + b, 0));
    expect(r.sections[0].title).toBe('Vigil Mass · Reading I');
    expect(r.sections[0].kind).toBe('reading1');
    const firstNight = r.sections[counts[0]];
    expect(firstNight.title.startsWith('Mass during the Night · ')).toBe(true);
    expect(r.sections.at(-1)?.title).toBe('Mass during the Day · Gospel');
    expect(r.feast).toBe('The Nativity of the Lord (Christmas)');
    expect(r.lectionary).toBe('13, 14, 15, 16');
    expect(r.sourceUrl).toBe('https://bible.usccb.org/bible/readings/122525.cfm');
  });

  it('throws when a page has neither readings nor Mass links', async () => {
    await expect(fetchUsccb('2026-10-25', async () => '<html><body><h2>x</h2></body></html>')).rejects.toThrow(/no readings/i);
  });
});
