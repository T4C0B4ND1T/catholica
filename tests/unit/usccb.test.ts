import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { describe, expect, it, vi } from 'vitest';
import { fetchUsccb, parseMassLinks, parseUsccb, parseUsccbRss, USCCB_RSS_URL, usccbUrl } from '@/lib/sources/usccb';

vi.mock('server-only', () => ({}));

const fx = (name: string) => readFileSync(join(__dirname, '../fixtures/usccb', `${name}.html`), 'utf8');
const rss = () => readFileSync(join(__dirname, '../fixtures/usccb/readings-2026-10-21.rss'), 'utf8');
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

  it('Palm Sunday: the Mass reading is reading1, the procession Gospel stays other, the Passion is the Gospel', () => {
    const r = parseUsccb(fx('palm-sunday-2026-03-29'), '2026-03-29');
    expect(r.sections.map((s) => [s.title, s.kind])).toEqual([
      ['At the Procession with Palms - Gospel', 'other'],
      ['At the Mass - Reading I', 'reading1'],
      ['Responsorial Psalm', 'psalm'],
      ['Reading II', 'reading2'],
      ['Verse before the Gospel', 'alleluia'],
      ['Gospel', 'gospel'],
      ['or', 'gospel'],
    ]);
    expect(r.sections.find((s) => s.kind === 'gospel')?.citation).toBe('Matthew 26:14—27:66');
  });

  it('All Souls: "Or:" is an alternate second reading', () => {
    const r = parseUsccb(fx('all-souls-2026-11-02'), '2026-11-02');
    expect(r.sections.map((s) => [s.title, s.kind])).toEqual([
      ['Reading I', 'reading1'],
      ['Responsorial Psalm', 'psalm'],
      ['Reading II', 'reading2'],
      ['Or:', 'reading2'],
      ['Alleluia', 'alleluia'],
      ['Gospel', 'gospel'],
    ]);
  });

  it('Easter Sunday: alternates and the afternoon Gospel keep the kind before them, the Sequence is named', () => {
    const r = parseUsccb(fx('easter-sunday-2026-04-05'), '2026-04-05');
    expect(r.sections.map((s) => [s.title, s.kind])).toEqual([
      ['Reading 1', 'reading1'],
      ['Responsorial Psalm', 'psalm'],
      ['Reading 2', 'reading2'],
      ['Or', 'reading2'],
      ['Sequence - Victimæ paschali laudes', 'sequence'],
      ['Alleluia', 'alleluia'],
      ['Gospel', 'gospel'],
      ['Or', 'gospel'],
      ['Or at afternoon or evening mass', 'gospel'],
    ]);
  });

  it('a leading alternate with nothing before it is other', () => {
    const block = (t: string) => `<div class="b-verse"><h3 class="name">${t}</h3><div class="content-body"><p>x</p></div></div>`;
    const r = parseUsccb(block('Or:') + block('Gospel'), '2026-10-25');
    expect(r.sections.map((s) => s.kind)).toEqual(['other', 'gospel']);
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

describe('parseUsccbRss', () => {
  it('gives the same sections, word for word, as the page for the same day', () => {
    const feed = parseUsccbRss(rss(), '2026-10-21');
    const page = parseUsccb(fx('weekday-2026-10-21'), '2026-10-21');
    expect(feed?.readings.sections).toEqual(page.sections);
    expect(feed?.readings.feast).toBe(page.feast);
    expect(feed?.readings.sourceUrl).toBe(page.sourceUrl);
    expect(feed?.readings.lectionary).toBeNull();
  });

  it('reads a Sunday with a second reading, citation without the heading', () => {
    const r = parseUsccbRss(rss(), '2026-10-18')!.readings;
    expect(r.feast).toBe('Twenty-ninth Sunday in Ordinary Time');
    expect(r.sections.map((s) => [s.title, s.kind, s.citation])).toEqual([
      ['Reading 1', 'reading1', 'Isaiah 45:1, 4-6'],
      ['Responsorial Psalm', 'psalm', 'Psalm 96:1, 3, 4-5, 7-8, 9-10'],
      ['Reading 2', 'reading2', '1 Thessalonians 1:1-5b'],
      ['Alleluia', 'alleluia', 'Philippians 2:15d, 16a'],
      ['Gospel', 'gospel', 'Matthew 22:15-21'],
    ]);
    expect(r.sections.every((s) => !s.text.includes('Copyright'))).toBe(true);
  });

  it('keeps the readings when an entry also links an optional memorial', () => {
    const entry = parseUsccbRss(rss(), '2026-10-20')!;
    expect(entry.readings.sections).toHaveLength(4);
    expect(entry.masses).toHaveLength(1);
  });

  it('is null for a date the feed does not hold', () => {
    expect(parseUsccbRss(rss(), '2026-10-25')).toBeNull();
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
  it('lists St John the Baptist Masses, whose links have no .cfm', () => {
    expect(parseMassLinks(fx('john-baptist-2026-06-24'))).toEqual([
      { name: 'Vigil', url: 'https://bible.usccb.org/bible/readings/062426-Vigil' },
      { name: 'Mass during the Day', url: 'https://bible.usccb.org/bible/readings/062426-Day' },
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

  it('reads the feed first and does not touch the page when the feed has the day', async () => {
    const urls: string[] = [];
    const r = await fetchUsccb('2026-10-21', async (u) => {
      urls.push(u);
      if (u === USCCB_RSS_URL) return rss();
      throw new Error('challenged');
    });
    expect(urls).toEqual([USCCB_RSS_URL]);
    expect(r.sections.map((s) => s.kind)).toEqual(['reading1', 'psalm', 'alleluia', 'gospel']);
  });

  it('falls back to the page for a day the feed does not hold', async () => {
    const r = await fetchUsccb('2026-10-25', async (u) => (u === USCCB_RSS_URL ? rss() : fetchText(u)));
    expect(r.lectionary).toBe('148');
  });

  it('follows Mass links in a feed entry that has no readings of its own', async () => {
    const item = `<rss><channel><item><title>The Nativity of the Lord (Christmas)</title>
      <link>https://bible.usccb.org/bible/readings/122525.cfm</link>
      <description>${cheerio.load(fx('christmas-2025-12-25'))('ul.nested').first().toString().replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</description>
      </item></channel></rss>`;
    const r = await fetchUsccb('2025-12-25', async (u) => (u === USCCB_RSS_URL ? item : fetchText(u)));
    expect([...new Set(r.sections.map((s) => s.mass))]).toEqual([
      'Vigil Mass', 'Mass during the Night', 'Mass at Dawn', 'Mass during the Day',
    ]);
    expect(r.feast).toBe('The Nativity of the Lord (Christmas)');
  });

  it('stamps fetchedAt on a normal page', async () => {
    const r = await fetchUsccb('2026-10-25', fetchText);
    expect(r.sections).toHaveLength(5);
    expect(new Date(r.fetchedAt).toString()).not.toBe('Invalid Date');
  });

  it('combines every Christmas Mass in page order, each section naming its Mass, titles verbatim', async () => {
    const r = await fetchUsccb('2025-12-25', fetchText);
    const counts = ['Vigil', 'Night', 'Dawn', 'Day'].map((m) => headingCount(fx(`christmas-2025-12-25-${m}`)));
    expect(r.sections).toHaveLength(counts.reduce((a, b) => a + b, 0));
    expect(r.sections[0]).toMatchObject({ mass: 'Vigil Mass', title: 'Reading I', kind: 'reading1' });
    expect(r.sections[counts[0]].mass).toBe('Mass during the Night');
    expect(r.sections.at(-1)).toMatchObject({ mass: 'Mass during the Day', title: 'Gospel', kind: 'gospel' });
    expect(r.sections.every((s) => !s.title.includes(' · '))).toBe(true);
    expect(r.feast).toBe('The Nativity of the Lord (Christmas)');
    expect(r.lectionary).toBe('13, 14, 15, 16');
    expect(r.sourceUrl).toBe('https://bible.usccb.org/bible/readings/122525.cfm');
  });

  it('leaves mass unset on a single-Mass day', async () => {
    const r = await fetchUsccb('2026-10-25', fetchText);
    expect(r.sections.every((s) => !('mass' in s))).toBe(true);
  });

  it('follows St John the Baptist links without .cfm', async () => {
    const jb: Record<string, string> = {
      'https://bible.usccb.org/bible/readings/062426.cfm': fx('john-baptist-2026-06-24'),
      'https://bible.usccb.org/bible/readings/062426-Vigil': fx('john-baptist-2026-06-24-Vigil'),
      'https://bible.usccb.org/bible/readings/062426-Day': fx('john-baptist-2026-06-24-Day'),
    };
    const r = await fetchUsccb('2026-06-24', async (u) => {
      if (!(u in jb)) throw new Error(`unexpected ${u}`);
      return jb[u];
    });
    expect([...new Set(r.sections.map((s) => s.mass))]).toEqual(['Vigil', 'Mass during the Day']);
    expect(r.sections.filter((s) => s.mass === 'Vigil').map((s) => s.kind)).toEqual([
      'reading1', 'psalm', 'reading2', 'alleluia', 'gospel',
    ]);
  });

  it('retries a Mass page up to 3 times with a short backoff', async () => {
    const sleep = vi.fn(async () => {});
    const tries: Record<string, number> = {};
    const flaky = async (u: string) => {
      tries[u] = (tries[u] ?? 0) + 1;
      if (u.endsWith('-Night.cfm') && tries[u] < 3) throw new Error('timeout');
      return fetchText(u);
    };
    const r = await fetchUsccb('2025-12-25', flaky, sleep);
    expect(tries['https://bible.usccb.org/bible/readings/122525-Night.cfm']).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(r.sections.some((s) => s.mass === 'Mass during the Night')).toBe(true);
  });

  it('gives up on a Mass page after 3 failed attempts', async () => {
    const sleep = vi.fn(async () => {});
    const down = async (u: string) => {
      if (u.endsWith('-Dawn.cfm')) throw new Error('still down');
      return fetchText(u);
    };
    await expect(fetchUsccb('2025-12-25', down, sleep)).rejects.toThrow('still down');
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('throws when a page has neither readings nor Mass links', async () => {
    await expect(fetchUsccb('2026-10-25', async () => '<html><body><h2>x</h2></body></html>')).rejects.toThrow(/no readings/i);
  });
});
