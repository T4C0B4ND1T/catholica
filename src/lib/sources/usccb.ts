import 'server-only';
import * as cheerio from 'cheerio';
import type { DailyReadings, ReadingKind, ReadingSection } from '@/lib/types';
import { fetchText as defaultFetchText } from './http';
import { usccbUrl } from './usccb-url';

export { usccbUrl };

export interface MassLink {
  name: string;
  url: string;
}

/** Collapses runs of spaces/tabs/newlines (and nbsp) to single spaces. */
function oneLine(s: string): string {
  return s.replace(/[\s ]+/g, ' ').trim();
}

/** Maps a heading such as "Reading II" or "Verse Before the Gospel" to a kind; anything unrecognised is 'other'. */
function kindOf(title: string, multiReading: boolean): ReadingKind {
  const t = title.toLowerCase();
  // A " - " qualifier: "At the Mass - Reading I" names the reading after it, "Sequence - Victimæ paschali laudes"
  // before it. The Palm Sunday procession Gospel is not the Mass Gospel (the Passion), so it stays 'other'.
  const parts = /^(.+?)\s+-\s+(.+)$/.exec(t);
  if (parts) {
    if (parts[1].startsWith('at the procession')) return 'other';
    const first = kindOf(parts[1], multiReading);
    return first !== 'other' ? first : kindOf(parts[2], multiReading);
  }
  if (/^reading\s+(1|i)$/.test(t)) return 'reading1';
  if (t.startsWith('responsorial psalm')) return 'psalm';
  // On a vigil with Reading III or later (or an Epistle), "Reading II" is just one of many Old Testament readings;
  // only the Epistle is the second reading.
  if (t === 'epistle') return 'reading2';
  if (/^reading\s+(2|ii)$/.test(t)) return multiReading ? 'other' : 'reading2';
  if (t.startsWith('sequence')) return 'sequence';
  if (t.startsWith('alleluia') || t.startsWith('verse before the gospel')) return 'alleluia';
  if (t === 'gospel') return 'gospel';
  return 'other';
}

/** "Or", "Or:" and "Or at afternoon or evening mass" offer an alternative to the section before them. */
const ALTERNATE = /^or\b/i;

/** Reading text with `<br>` as newlines and paragraphs separated by a blank line. Words are copied as published. */
function bodyText($: cheerio.CheerioAPI, body: cheerio.Cheerio<never>): string {
  const clone = body.clone();
  clone.find('br').replaceWith('\n');
  const blocks = clone.find('p').length
    ? clone
        .find('p')
        .map((_, p) => $(p).text())
        .get()
    : [clone.text()];
  return blocks
    .map((b) =>
      b
        .replace(/ /g, ' ')
        .split('\n')
        .map((line) => line.replace(/[ \t\r\f\v]+/g, ' ').trim())
        .join('\n')
        .trim(),
    )
    .filter(Boolean)
    .join('\n\n');
}

/** Parses one USCCB daily-readings page. A landing page (e.g. Christmas) yields no sections; see parseMassLinks. */
export function parseUsccb(html: string, date: string): Omit<DailyReadings, 'fetchedAt'> {
  const $ = cheerio.load(html);
  const lect = $('.b-lectionary').first();
  const feast = oneLine(lect.find('h2').first().text());
  const lectionary = /Lectionary:\s*(.+)/.exec(oneLine(lect.find('p').first().text()))?.[1].trim() ?? null;

  const titles = $('.b-verse h3.name')
    .map((_, h) => oneLine($(h).text()).toLowerCase())
    .get();
  const multiReading = titles.some((t) => t === 'epistle' || /^reading\s+(3|4|5|6|7|iii|iv|v|vi|vii)$/.test(t));

  const sections: ReadingSection[] = [];
  $('.b-verse').each((_, block) => {
    const b = $(block);
    const title = oneLine(b.find('h3.name').first().text());
    if (!title) return;
    const text = bodyText($, b.find('.content-body').first() as cheerio.Cheerio<never>);
    if (!text) throw new Error(`USCCB page for ${date}: "${title}" has an empty body`);
    // An alternate takes the kind of the section before it; the title is kept as published.
    const kind = ALTERNATE.test(title) ? (sections.at(-1)?.kind ?? 'other') : kindOf(title, multiReading);
    sections.push({ kind, title, citation: oneLine(b.find('.address').first().text()), text });
  });

  return { date, feast, lectionary, sections, sourceUrl: usccbUrl(date) };
}

/** The Mass options a landing page links to (`ul.nested a.item`), in page order. */
export function parseMassLinks(html: string): MassLink[] {
  const $ = cheerio.load(html);
  const links: MassLink[] = [];
  $('ul.nested a.item').each((_, a) => {
    const href = $(a).attr('href');
    const name = oneLine($(a).text());
    if (!href || !name) return;
    const url = new URL(href, 'https://bible.usccb.org');
    if (url.origin === 'https://bible.usccb.org') links.push({ name, url: url.toString() });
  });
  return links;
}

/**
 * Fetches and parses a day's readings. When the page is a landing page of several Masses, every Mass page is fetched
 * in page order and the sections are concatenated, each title prefixed with the Mass name.
 */
export async function fetchUsccb(
  date: string,
  fetchText: (url: string) => Promise<string> = defaultFetchText,
): Promise<DailyReadings> {
  const html = await fetchText(usccbUrl(date));
  const parsed = parseUsccb(html, date);
  let sections = parsed.sections;

  if (!sections.length) {
    const masses = parseMassLinks(html);
    if (!masses.length) throw new Error(`USCCB page for ${date} has no readings`);
    sections = [];
    for (const m of masses) {
      const mass = parseUsccb(await fetchText(m.url), date);
      if (!mass.sections.length) throw new Error(`USCCB ${m.name} page for ${date} has no readings`);
      sections.push(...mass.sections.map((s) => ({ ...s, title: `${m.name} · ${s.title}` })));
    }
  }
  return { ...parsed, sections, fetchedAt: new Date().toISOString() };
}
