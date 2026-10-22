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

interface RawSection {
  title: string;
  citation: string;
  text: string;
}

/** Classifies sections in page order. On a vigil with Reading III or later (or an Epistle), "Reading II" is 'other'. */
function classify(raw: RawSection[], date: string): ReadingSection[] {
  const titles = raw.map((r) => r.title.toLowerCase());
  const multiReading = titles.some((t) => t === 'epistle' || /^reading\s+(3|4|5|6|7|iii|iv|v|vi|vii)$/.test(t));
  const sections: ReadingSection[] = [];
  for (const { title, citation, text } of raw) {
    if (!text) throw new Error(`USCCB readings for ${date}: "${title}" has an empty body`);
    // An alternate takes the kind of the section before it; the title is kept as published.
    const kind = ALTERNATE.test(title) ? (sections.at(-1)?.kind ?? 'other') : kindOf(title, multiReading);
    sections.push({ kind, title, citation, text });
  }
  return sections;
}

/** Parses one USCCB daily-readings page. A landing page (e.g. Christmas) yields no sections; see parseMassLinks. */
export function parseUsccb(html: string, date: string): Omit<DailyReadings, 'fetchedAt'> {
  const $ = cheerio.load(html);
  const lect = $('.b-lectionary').first();
  const feast = oneLine(lect.find('h2').first().text());
  const lectionary = /Lectionary:\s*(.+)/.exec(oneLine(lect.find('p').first().text()))?.[1].trim() ?? null;

  const raw: RawSection[] = [];
  $('.b-verse').each((_, block) => {
    const b = $(block);
    const title = oneLine(b.find('h3.name').first().text());
    if (!title) return;
    raw.push({
      title,
      citation: oneLine(b.find('.address').first().text()),
      text: bodyText($, b.find('.content-body').first() as cheerio.Cheerio<never>),
    });
  });

  return { date, feast, lectionary, sections: classify(raw, date), sourceUrl: usccbUrl(date) };
}

/** USCCB's own feed of the last ten days' readings. It carries the same text as the pages. */
export const USCCB_RSS_URL = 'https://bible.usccb.org/readings.rss';

/**
 * The day's entry in USCCB's readings feed, or null when the feed has no entry for that date (the feed holds only the
 * last ten days; a day appears at 4:30 a.m. Eastern). Each `<h4>` is a heading with its citation as a link, followed by
 * the reading in `<div>`s. A multi-Mass day lists its Mass pages as `ul.nested a.item`, as the landing page does.
 * The feed has no Lectionary number, so `lectionary` is null.
 */
export function parseUsccbRss(xml: string, date: string): { readings: Omit<DailyReadings, 'fetchedAt'>; masses: MassLink[] } | null {
  const feed = cheerio.load(xml, { xml: true });
  const url = usccbUrl(date);
  const item = feed('item')
    .filter((_, el) => feed(el).children('link').text().trim() === url)
    .first();
  if (!item.length) return null;

  const descriptionHtml = item.children('description').text();
  const $ = cheerio.load(descriptionHtml);
  const raw: RawSection[] = [];
  $('h4').each((_, h) => {
    const head = $(h);
    const citation = oneLine(head.find('a').first().text());
    const title = oneLine(head.clone().find('a').remove().end().text());
    if (!title) return;
    const body = $('<div></div>');
    head.nextUntil('h4', 'div').each((_, d) => {
      body.append($(d).clone());
    });
    raw.push({ title, citation, text: bodyText($, body as cheerio.Cheerio<never>) });
  });

  return {
    readings: {
      date,
      feast: oneLine(item.children('title').text()),
      lectionary: null,
      sections: classify(raw, date),
      sourceUrl: url,
    },
    masses: parseMassLinks(descriptionHtml),
  };
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

const MASS_PAGE_ATTEMPTS = 3;
const RETRY_BASE_MS = 1000;

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** One Mass page, retried up to 3 times (1s, then 2s apart): a landing day needs every page to succeed. */
async function fetchMassPage(
  url: string,
  fetchText: (url: string) => Promise<string>,
  sleep: (ms: number) => Promise<void>,
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchText(url);
    } catch (e) {
      if (attempt >= MASS_PAGE_ATTEMPTS) throw e;
      await sleep(RETRY_BASE_MS * attempt);
    }
  }
}

/** Fetches every Mass page in order and concatenates their sections, each naming its Mass in `mass`. */
async function fetchMasses(
  masses: MassLink[],
  date: string,
  fetchText: (url: string) => Promise<string>,
  sleep: (ms: number) => Promise<void>,
): Promise<ReadingSection[]> {
  const sections: ReadingSection[] = [];
  for (const m of masses) {
    const mass = parseUsccb(await fetchMassPage(m.url, fetchText, sleep), date);
    if (!mass.sections.length) throw new Error(`USCCB ${m.name} page for ${date} has no readings`);
    sections.push(...mass.sections.map((s) => ({ ...s, mass: m.name })));
  }
  return sections;
}

/** The day's readings from the feed, or null when the feed is unreachable or has no usable entry for the date. */
async function fromRss(
  date: string,
  fetchText: (url: string) => Promise<string>,
  sleep: (ms: number) => Promise<void>,
): Promise<Omit<DailyReadings, 'fetchedAt'> | null> {
  let entry: ReturnType<typeof parseUsccbRss>;
  try {
    entry = parseUsccbRss(await fetchText(USCCB_RSS_URL), date);
  } catch {
    return null;
  }
  if (!entry) return null;
  if (entry.readings.sections.length) return entry.readings;
  if (!entry.masses.length) return null;
  return { ...entry.readings, sections: await fetchMasses(entry.masses, date, fetchText, sleep) };
}

/**
 * Fetches and parses a day's readings. USCCB's feed comes first: its pages challenge requests from datacenters such as
 * Vercel's, while the feed has answered them. Dates the feed does not hold (future days) come from the page. When the
 * page is a landing page of several Masses, every Mass page is fetched in page order and the sections are
 * concatenated, each naming its Mass in `mass` (titles stay as published).
 */
export async function fetchUsccb(
  date: string,
  fetchText: (url: string) => Promise<string> = defaultFetchText,
  sleep: (ms: number) => Promise<void> = realSleep,
): Promise<DailyReadings> {
  const rss = await fromRss(date, fetchText, sleep);
  if (rss) return { ...rss, fetchedAt: new Date().toISOString() };

  const html = await fetchText(usccbUrl(date));
  const parsed = parseUsccb(html, date);
  let sections = parsed.sections;

  if (!sections.length) {
    const masses = parseMassLinks(html);
    if (!masses.length) throw new Error(`USCCB page for ${date} has no readings`);
    sections = await fetchMasses(masses, date, fetchText, sleep);
  }
  return { ...parsed, sections, fetchedAt: new Date().toISOString() };
}
