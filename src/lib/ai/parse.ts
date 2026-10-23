/** Parsers for the AI model's JSON answers (safe to import anywhere). */

import type { BulletinSummary, ReflectionInsights } from '@/lib/types';

/** The JSON inside an answer, without the ```json fence some models wrap it in. */
function unfence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
}

/** The questions from the model's JSON answer: 1 to 6 non-empty strings, or it throws. */
export function parseQuestions(text: string): string[] {
  let value: unknown;
  try {
    value = JSON.parse(unfence(text));
  } catch {
    throw new Error('The AI model returned questions that are not JSON');
  }
  const list = Array.isArray(value) ? value.filter((q): q is string => typeof q === 'string' && q.trim() !== '') : [];
  if (list.length === 0) throw new Error('The AI model returned no questions');
  return list.slice(0, 6).map((q) => q.trim());
}

const strings = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()).slice(0, max) : [];

/** A bulletin summary from the model's JSON answer. Throws when it is not JSON or holds nothing. */
export function parseBulletinSummary(text: string): BulletinSummary {
  let value: unknown;
  try {
    value = JSON.parse(unfence(text));
  } catch {
    throw new Error('The AI model returned a bulletin summary that is not JSON');
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
    throw new Error('The AI model returned an empty bulletin summary');
  }
  return summary;
}

/** The day's insights from the model's JSON answer. Throws when it is not JSON or misses the theology or the prayer. */
export function parseInsights(text: string): ReflectionInsights {
  let value: unknown;
  try {
    value = JSON.parse(unfence(text));
  } catch {
    throw new Error('The AI model returned insights that are not JSON');
  }
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const theology = typeof v.theology === 'string' ? v.theology.trim() : '';
  const prayer = typeof v.prayer === 'string' ? v.prayer.trim() : '';
  if (!theology || !prayer) throw new Error('The AI model returned insights without a theology note or a prayer');
  const seen = new Set<number>();
  const catechism = (Array.isArray(v.catechism) ? v.catechism : [])
    .map((c) => (typeof c === 'object' && c !== null ? (c as Record<string, unknown>) : {}))
    .map((c) => ({
      paragraph: Number(c.paragraph),
      connection: typeof c.connection === 'string' ? c.connection.trim() : '',
    }))
    .filter((c) => Number.isInteger(c.paragraph) && c.paragraph >= 1 && c.paragraph <= 2865 && c.connection)
    .filter((c) => !seen.has(c.paragraph) && seen.add(c.paragraph))
    .slice(0, 4);
  return { theology, catechism, prayer };
}
