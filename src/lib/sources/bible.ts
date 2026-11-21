import 'server-only';
import * as cheerio from 'cheerio';
import type { ReadingSection } from '@/lib/types';
import { alignVerses, parseCitation, type VerseRef } from '@/lib/verses';
import { fetchText as defaultFetchText } from './http';

/** A chapter of USCCB's Bible (NABRE), e.g. https://bible.usccb.org/bible/ephesians/3. */
export function bibleChapterUrl(book: string, chapter: number): string {
  return `https://bible.usccb.org/bible/${book}/${chapter}`;
}

/**
 * The verses of one Bible chapter page, by number. Each verse runs from its `span.bcv` number to the next one;
 * headings, footnote and cross-reference markers are left out.
 */
export function parseBibleChapter(html: string): Map<number, string> {
  const $ = cheerio.load(html);
  const body = $('.contentarea').first();
  body.find('h1, h2, h3, h4, h5, a.fnref, a.enref, sup, .fn, .en, script, style').remove();
  const verses = new Map<number, string>();
  let current: number | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (current !== null) verses.set(current, buf.join('').replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim());
    buf = [];
  };
  const walk = (nodes: ReturnType<typeof body.contents>) => {
    nodes.each((_, node) => {
      if (node.type === 'text') {
        buf.push((node as unknown as { data: string }).data);
        return;
      }
      if (node.type !== 'tag') return;
      const el = $(node);
      if (el.is('span.bcv')) {
        const v = Number(el.text().trim());
        if (Number.isInteger(v) && v > 0) {
          flush();
          current = v;
        }
        return;
      }
      walk(el.contents());
      if (/^(p|div|li|br|h\d)$/i.test((node as unknown as { name: string }).name)) buf.push(' ');
    });
  };
  walk(body.contents());
  flush();
  return verses;
}

type Fetch = (url: string) => Promise<string>;

const ATTEMPTS = 3;
const RETRY_MS = 1500;

/** USCCB's Bible answers bursts of requests with 403 for a moment, so each chapter gets up to three tries. */
async function fetchChapter(url: string, fetchText: Fetch, sleep: (ms: number) => Promise<void>): Promise<Map<number, string>> {
  for (let attempt = 1; ; attempt++) {
    try {
      return parseBibleChapter(await fetchText(url));
    } catch (e) {
      if (attempt >= ATTEMPTS) throw e;
      await sleep(RETRY_MS * attempt);
    }
  }
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Finds where each verse of a section begins, from its citation and USCCB's Bible. Returns undefined when the
 * citation can't be read, a chapter can't be fetched, or no verse lines up; the caller keeps the section without
 * verse numbers. `chapters` caches chapter pages across the day's sections.
 */
export async function findVerses(
  section: Pick<ReadingSection, 'citation' | 'text'>,
  fetchText: Fetch = defaultFetchText,
  chapters: Map<string, Promise<Map<number, string>>> = new Map(),
  sleep: (ms: number) => Promise<void> = realSleep,
): Promise<ReadingSection['verses']> {
  const cited = parseCitation(section.citation);
  if (!cited) return undefined;
  const wanted = [...new Set(cited.refs.map((r) => r.chapter))];
  const texts = new Map<number, Map<number, string>>();
  try {
    for (const ch of wanted) {
      const url = bibleChapterUrl(cited.book, ch);
      let page = chapters.get(url);
      if (!page) {
        page = fetchChapter(url, fetchText, sleep);
        chapters.set(url, page);
      }
      texts.set(ch, await page);
    }
  } catch {
    return undefined;
  }
  const verses: { ref: VerseRef; text: string }[] = [];
  for (const ref of cited.refs) {
    const t = texts.get(ref.chapter)?.get(ref.verse);
    if (t) verses.push({ ref, text: t });
  }
  const marks = alignVerses(section.text, verses);
  return marks.length ? marks : undefined;
}

/**
 * The sections with verse numbers added where they can be found. A section that already has them is kept as is.
 * Pass `chapters` to share fetched chapters across days.
 */
export async function addVerses<T extends Pick<ReadingSection, 'citation' | 'text' | 'verses'>>(
  sections: T[],
  fetchText: Fetch = defaultFetchText,
  sleep: (ms: number) => Promise<void> = realSleep,
  chapters: Map<string, Promise<Map<number, string>>> = new Map(),
): Promise<T[]> {
  const out: T[] = [];
  for (const s of sections) {
    if (s.verses?.length) {
      out.push(s);
      continue;
    }
    const verses = await findVerses(s, fetchText, chapters, sleep);
    out.push(verses ? { ...s, verses } : s);
  }
  return out;
}
