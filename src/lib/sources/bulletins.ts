import 'server-only';
import { extractText, getDocumentProxy } from 'unpdf';
import { fetchBytes, SourceError } from './http';

const BASE = 'https://files.ecatholic.com/17181/bulletins';

/** PDF URL for a Sunday ('2026-10-18' -> .../20261018.pdf). The list page is behind a Cloudflare challenge, so we probe by date. */
export function bulletinUrl(sunday: string): string {
  return `${BASE}/${sunday.replaceAll('-', '')}.pdf`;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

/**
 * The bulletin PDF for a Sunday, or null when not posted (the host answers 403 or 404 for unknown dates).
 * Any other failure, or a body that is not a PDF, throws SourceError.
 */
export async function fetchBulletinPdf(sunday: string): Promise<Uint8Array | null> {
  const url = bulletinUrl(sunday);
  let bytes: Uint8Array;
  try {
    bytes = await fetchBytes(url);
  } catch (e) {
    if (e instanceof SourceError && (e.status === 403 || e.status === 404)) return null;
    throw e;
  }
  if (!PDF_MAGIC.every((b, i) => bytes[i] === b)) throw new SourceError(`GET ${url} did not return a PDF`, 200);
  return bytes;
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
