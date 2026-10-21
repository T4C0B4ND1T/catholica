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

/** Extracts exactly paragraph `num` from the source's HTML; null if it is not in the response. */
export function parseCatechismResponse(json: { html: string }, num: number): CatechismParagraph | null {
  const $ = cheerio.load(json.html ?? '');
  const para = $(`div.paragraph#para-${num}`).first();
  if (!para.length) return null;

  const body = para.find('.para > .text').first().clone();
  body.find('a:has(sup)').remove(); // footnote markers
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

/** Verbatim Catechism paragraph from the public cross-reference site. Never AI text. */
export async function fetchCatechism(num: number): Promise<CatechismParagraph | null> {
  if (!Number.isInteger(num) || num < 1 || num > MAX_PARAGRAPH) return null;
  const raw = await postForm(ENDPOINT, { TOKEN: '1', lang: 'en', query: String(num), offset: '0' });
  let json: { html: string };
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  return parseCatechismResponse(json, num);
}
