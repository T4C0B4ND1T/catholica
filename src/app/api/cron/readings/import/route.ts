import { getReadings, saveReadings } from '@/lib/db/readings';
import { assertCron } from '@/lib/jobs/cron-auth';
import { dateParam } from '@/lib/dates';
import { usccbUrl } from '@/lib/sources/usccb-url';
import type { DailyReadings, ReadingKind, ReadingSection } from '@/lib/types';

/** Most days per request, so one upload stays well inside a function's body and time limits. */
const MAX_DAYS = 31;
const KINDS = new Set<ReadingKind>(['reading1', 'psalm', 'reading2', 'sequence', 'alleluia', 'gospel', 'other']);

const isText = (v: unknown): v is string => typeof v === 'string';

function toSection(v: unknown): ReadingSection | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  if (!KINDS.has(s.kind as ReadingKind) || !isText(s.title) || !isText(s.citation) || !isText(s.text) || !s.text) {
    return null;
  }
  if (s.mass !== undefined && !isText(s.mass)) return null;
  const section: ReadingSection = { kind: s.kind as ReadingKind, title: s.title, citation: s.citation, text: s.text };
  if (isText(s.mass)) section.mass = s.mass;
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
 * Saves days of readings fetched from USCCB somewhere its pages load (its pages challenge Vercel's servers). Takes a
 * JSON array of up to 31 days in the shape fetchUsccb returns; days already saved are left as they are.
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
  const skipped: string[] = [];
  for (const day of days as DailyReadings[]) {
    if (await getReadings(day.date)) {
      skipped.push(day.date);
      continue;
    }
    await saveReadings(day);
    saved.push(day.date);
  }
  return Response.json({ saved, skipped }, { headers });
}
