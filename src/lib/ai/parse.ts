/** Parsers for Gemini's JSON answers (safe to import anywhere). */

import type { BulletinSummary } from '@/lib/types';

/** The questions from Gemini's JSON answer: 1 to 6 non-empty strings, or it throws. */
export function parseQuestions(text: string): string[] {
  let value: unknown;
  try {
    value = JSON.parse(text.trim());
  } catch {
    throw new Error('Gemini returned questions that are not JSON');
  }
  const list = Array.isArray(value) ? value.filter((q): q is string => typeof q === 'string' && q.trim() !== '') : [];
  if (list.length === 0) throw new Error('Gemini returned no questions');
  return list.slice(0, 6).map((q) => q.trim());
}

const strings = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()).slice(0, max) : [];

/** A bulletin summary from Gemini's JSON answer. Throws when it is not JSON or holds nothing. */
export function parseBulletinSummary(text: string): BulletinSummary {
  let value: unknown;
  try {
    value = JSON.parse(text.trim());
  } catch {
    throw new Error('Gemini returned a bulletin summary that is not JSON');
  }
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const announcements = (Array.isArray(v.announcements) ? v.announcements : [])
    .map((a) => (typeof a === 'object' && a !== null ? (a as Record<string, unknown>) : {}))
    .map((a) => ({
      title: typeof a.title === 'string' ? a.title.trim() : '',
      text: typeof a.text === 'string' ? a.text.trim() : '',
    }))
    .filter((a) => a.title || a.text)
    .slice(0, 12);
  const summary = { massTimes: strings(v.massTimes, 20), confession: strings(v.confession, 10), announcements };
  if (!summary.massTimes.length && !summary.confession.length && !announcements.length) {
    throw new Error('Gemini returned an empty bulletin summary');
  }
  return summary;
}
