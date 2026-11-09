import 'server-only';
import * as cheerio from 'cheerio';
import { extractText, getDocumentProxy } from 'unpdf';
import { addDays, todayInChicago } from '@/lib/dates';
import { fetchBytes, fetchText, SourceError } from './http';

const BASE = 'https://files.ecatholic.com/17181/bulletins';

/** PDF URL for a Sunday ('2026-10-18' -> .../20261018.pdf). The list page is behind a Cloudflare challenge, so we probe by date. */
export function bulletinUrl(sunday: string): string {
  return `${BASE}/${sunday.replaceAll('-', '')}.pdf`;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

/** St. Anselm's page on Discover Mass, which links only the current week's bulletin. */
export const DISCOVERMASS_PAGE = 'https://discovermass.com/church/st-anselm-madisonville-la/';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** 'Nov 8, 2026' or 'November 8, 2026' -> '2026-11-08'; null when the text holds no such date. */
export function parseBulletinDate(label: string): string | null {
  const m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(\d{4})\b/.exec(label);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  if (month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/** The current bulletin's date and download URL from the Discover Mass page HTML, or null when none is linked. */
export function parseDiscoverMass(html: string): { sunday: string; url: string } | null {
  const $ = cheerio.load(html);
  for (const a of $('a[href*="bulletins.discovermass.com/download.php"]').toArray()) {
    const sunday = parseBulletinDate($(a).text());
    const href = $(a).attr('href');
    if (sunday && href) return { sunday, url: new URL(href, DISCOVERMASS_PAGE).toString() };
  }
  return null;
}

function assertPdf(bytes: Uint8Array, url: string): Uint8Array {
  if (!PDF_MAGIC.every((b, i) => bytes[i] === b)) throw new SourceError(`GET ${url} did not return a PDF`, 200);
  return bytes;
}

export interface FetchedBulletin {
  bytes: Uint8Array;
  /** Where the parish posted it: the ecatholic PDF, or the Discover Mass page. */
  sourceUrl: string;
}

async function fromEcatholic(sunday: string): Promise<FetchedBulletin | null> {
  const url = bulletinUrl(sunday);
  try {
    return { bytes: assertPdf(await fetchBytes(url), url), sourceUrl: url };
  } catch (e) {
    if (e instanceof SourceError && (e.status === 403 || e.status === 404)) return null;
    throw e;
  }
}

/** The Discover Mass bulletin when it is the one for this Sunday, else null. */
async function fromDiscoverMass(sunday: string): Promise<FetchedBulletin | null> {
  const current = parseDiscoverMass(await fetchText(DISCOVERMASS_PAGE));
  if (!current || current.sunday !== sunday) return null;
  return { bytes: assertPdf(await fetchBytes(current.url), current.url), sourceUrl: DISCOVERMASS_PAGE };
}

/**
 * The bulletin PDF for a Sunday, or null when not posted. The ecatholic archive is tried first (403/404 means not
 * there); since November 2026 the parish sometimes posts only to Discover Mass, which lists just the current week,
 * so that page is the fallback for recent Sundays. Real failures, or a body that is not a PDF, throw SourceError.
 */
export async function fetchBulletinPdf(sunday: string, now: Date = new Date()): Promise<FetchedBulletin | null> {
  // Discover Mass only ever shows this week's bulletin (or next week's late in the week), so older dates skip it.
  const recent = sunday >= addDays(todayInChicago(now), -13);
  let ecatholicError: unknown = null;
  try {
    const hit = await fromEcatholic(sunday);
    if (hit) return hit;
  } catch (e) {
    ecatholicError = e;
  }
  if (recent) {
    try {
      const hit = await fromDiscoverMass(sunday);
      if (hit) return hit;
    } catch (e) {
      throw ecatholicError ?? e;
    }
  }
  if (ecatholicError) throw ecatholicError;
  return null;
}

/** Postgres text cannot hold NUL or unpaired surrogates, which some parish PDFs emit; drop them. */
export function toStorableText(text: string): string {
  return text.replaceAll('\u0000', '').toWellFormed();
}

/** Text of every page joined (verbatim from the PDF, for search) and the page count. */
export async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  // unpdf may transfer the buffer to its worker, so hand it a copy and keep the caller's bytes intact.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    return { text: toStorableText(text), pageCount: totalPages };
  } finally {
    await pdf.loadingTask.destroy();
  }
}
