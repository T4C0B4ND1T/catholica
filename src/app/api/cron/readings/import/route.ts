import { getReadings, saveReadings } from '@/lib/db/readings';
import { assertCron } from '@/lib/jobs/cron-auth';
import { dateParam } from '@/lib/dates';
import { usccbUrl } from '@/lib/sources/usccb-url';
import type { DailyReadings, ReadingKind, ReadingSection, VerseMark } from '@/lib/types';

/** Most days per request, so one upload stays well inside a function's body and time limits. */
const MAX_DAYS = 31;
const KINDS = new Set<ReadingKind>(['reading1', 'psalm', 'reading2', 'sequence', 'alleluia', 'gospel', 'other']);

const isText = (v: unknown): v is string => typeof v === 'string';
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

/** Verse marks in text order, each inside the text, or null when they aren't. */
function toVerses(v: unknown, text: string): VerseMark[] | null {
  if (!Array.isArray(v) || !v.length) return null;
  const out: VerseMark[] = [];
  for (const m of v) {
    if (!m || typeof m !== 'object') return null;
    const { at, chapter, verse } = m as Record<string, unknown>;
    if (!isCount(at) || !isCount(chapter) || !isCount(verse) || at >= text.length) return null;
    if (out.length && at <= out[out.length - 1].at) return null;
    out.push({ at, chapter, verse });
  }
  return out;
}

function toSection(v: unknown): ReadingSection | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  if (!KINDS.has(s.kind as ReadingKind) || !isText(s.title) || !isText(s.citation) || !isText(s.text) || !s.text) {
    return null;
  }
  if (s.mass !== undefined && !isText(s.mass)) return null;
  const section: ReadingSection = { kind: s.kind as ReadingKind, title: s.title, citation: s.citation, text: s.text };
  if (isText(s.mass)) section.mass = s.mass;
  if (s.verses !== undefined) {
    const verses = toVerses(s.verses, s.text);
    if (!verses) return null;
    section.verses = verses;
  }
  return section;
}

/** A day of readings parsed from USCCB elsewhere, or null when it isn't one. */
function toReadings(v: unknown): DailyReadings | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const date = isText(r.date) ? dateParam(r.date) : null;
  if (!date || !isText(r.feast) || !isText(r.fetchedAt) || Number.isNaN(Date.parse(r.fetchedAt))) return null;
  if (r.lectionary !== null && !isText(r.lectionary)) return null;
  // The source is always the day's own USCCB page, never a URL from the caller.
  if (r.sourceUrl !== usccbUrl(date) || !Array.isArray(r.sections) || !r.sections.length) return null;
  const sections = r.sections.map(toSection);
  if (sections.some((s) => !s)) return null;
  return {
    date,
    feast: r.feast,
    lectionary: r.lectionary,
    sections: sections as ReadingSection[],
    sourceUrl: r.sourceUrl,
    fetchedAt: r.fetchedAt,
  };
}

/**
 * The saved day with the upload's verse numbers added, or null when the upload adds none or its sections differ from
 * the saved ones in any title, citation or text (then the saved day is left alone).
 */
function withNewVerses(saved: DailyReadings, upload: DailyReadings): DailyReadings | null {
  if (saved.sections.length !== upload.sections.length) return null;
  let added = false;
  const sections = saved.sections.map((s, i) => {
    const u = upload.sections[i];
    if (s.title !== u.title || s.citation !== u.citation || s.text !== u.text || (s.mass ?? null) !== (u.mass ?? null)) {
      return null;
    }
    if (s.verses?.length || !u.verses?.length) return s;
    added = true;
    return { ...s, verses: u.verses };
  });
  if (sections.some((s) => !s) || !added) return null;
  return { ...saved, sections: sections as ReadingSection[] };
}

/**
 * Saves days of readings fetched from USCCB somewhere its pages load (its pages challenge Vercel's servers). Takes a
 * JSON array of up to 31 days in the shape fetchUsccb returns. A day already saved is left as it is, except that verse
 * numbers are added to its sections when the upload has them and its text is the same as the saved text.
 */
export async function POST(req: Request): Promise<Response> {
  const denied = assertCron(req);
  if (denied) return denied;
  const headers = { 'Cache-Control': 'no-store' };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Body must be JSON' }, { status: 400, headers });
  }
  if (!Array.isArray(body) || !body.length || body.length > MAX_DAYS) {
    return Response.json({ error: `Send an array of 1 to ${MAX_DAYS} days` }, { status: 400, headers });
  }
  const days = body.map(toReadings);
  const bad = days.findIndex((d) => !d);
  if (bad !== -1) return Response.json({ error: `Day ${bad} is not valid readings` }, { status: 400, headers });

  const saved: string[] = [];
  const versed: string[] = [];
  const skipped: string[] = [];
  for (const day of days as DailyReadings[]) {
    const stored = await getReadings(day.date);
    if (stored) {
      const merged = withNewVerses(stored, day);
      if (merged) {
        await saveReadings(merged);
        versed.push(day.date);
      } else skipped.push(day.date);
      continue;
    }
    await saveReadings(day);
    saved.push(day.date);
  }
  return Response.json({ saved, versed, skipped }, { headers });
}
