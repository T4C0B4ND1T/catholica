import 'server-only';
import * as cheerio from 'cheerio';
import { postForm } from './http';

const ENDPOINT = 'https://www.catholiccrossreference.online/catechism/';
export const MAX_PARAGRAPH = 2865;

export interface CatechismParagraph {
  num: number;
  title: string;
  text: string;
  footnotes: string[];
  crossRefs: number[];
  sourceUrl: string;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** One `div.paragraph` as source text, or null when it has no text. */
function parseParagraph($: cheerio.CheerioAPI, para: cheerio.Cheerio<never>, num: number): CatechismParagraph | null {
  const body = para.find('.para > .text').first().clone();
  body.find('a:has(sup)').remove(); // footnote markers
  body.find('sup').remove(); // a marker without its link
  const text = clean(body.text());
  if (!text) return null;

  // Nearest heading before the paragraph in document order.
  let title = '';
  $('.heading, div.paragraph').each((_, el) => {
    if ($(el).is(para)) return false;
    if ($(el).hasClass('heading')) {
      const h = $(el).clone();
      h.find('a').remove();
      title = clean(h.text());
    }
  });

  const footnotes = para
    .find('.footnotes .note')
    .map((_, n) => clean(`${$(n).find('.num').text()} ${$(n).find('.text').text()}`))
    .get()
    .filter(Boolean);

  const crossRefs: number[] = [];
  para.find('.xrefs a').each((_, a) => {
    const t = clean($(a).text());
    if (/^\d+$/.test(t) && !crossRefs.includes(Number(t))) crossRefs.push(Number(t));
  });

  return { num, title, text, footnotes, crossRefs, sourceUrl: `${ENDPOINT}#!/search/${num}` };
}

/** Extracts exactly paragraph `num` from the source's HTML; null if it is not in the response. */
export function parseCatechismResponse(json: { html: string }, num: number): CatechismParagraph | null {
  const $ = cheerio.load(json.html ?? '');
  const para = $(`div.paragraph#para-${num}`).first();
  if (!para.length) return null;
  return parseParagraph($, para as cheerio.Cheerio<never>, num);
}

/** Every paragraph of a search page, in page order, and the total from "Results 1 - N of M". */
export function parseCatechismSearch(json: { html: string }): { total: number; paragraphs: CatechismParagraph[] } {
  const $ = cheerio.load(json.html ?? '');
  const paragraphs: CatechismParagraph[] = [];
  $('div.paragraph').each((_, el) => {
    const num = Number(/^para-(\d+)$/.exec($(el).attr('id') ?? '')?.[1]);
    if (!Number.isInteger(num) || paragraphs.some((p) => p.num === num)) return;
    const p = parseParagraph($, $(el) as cheerio.Cheerio<never>, num);
    if (p) paragraphs.push(p);
  });
  const total = Number(/Results\s+\d+\s*-\s*\d+\s+of\s+(\d+)/.exec($.root().text())?.[1] ?? paragraphs.length);
  return { total, paragraphs };
}

/** The source's JSON answer. A 200 that is not JSON (a maintenance page) is a failure, not "no such paragraph". */
async function query(q: string): Promise<{ html: string }> {
  const raw = await postForm(ENDPOINT, { TOKEN: '1', lang: 'en', query: q, offset: '0' });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('Catechism source returned non-JSON');
  }
  if (typeof json !== 'object' || json === null || typeof (json as { html?: unknown }).html !== 'string') {
    throw new Error('Catechism source returned an unexpected shape');
  }
  return json as { html: string };
}

/** Verbatim Catechism paragraph from the public cross-reference site. Never AI text. */
export async function fetchCatechism(num: number): Promise<CatechismParagraph | null> {
  if (!Number.isInteger(num) || num < 1 || num > MAX_PARAGRAPH) return null;
  return parseCatechismResponse(await query(String(num)), num);
}

/** Keyword or "quoted phrase" search, first page (25 paragraphs) only. Verbatim source text. */
export async function searchCatechism(q: string): Promise<{ total: number; paragraphs: CatechismParagraph[] }> {
  return parseCatechismSearch(await query(q));
}
