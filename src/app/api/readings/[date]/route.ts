import { readReadings, readReflection } from '@/lib/db/readings';
import { liturgicalDay } from '@/lib/liturgical/calendar';

type Ctx = { params: Promise<{ date: string }> };

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const year = Number(s.slice(0, 4));
  if (year < 1970 || year > 2100) return false;
  return new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
}

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { date } = await params;
  if (!validDate(date)) return Response.json({ error: 'Invalid date' }, { status: 400 });

  let readings, reflection;
  try {
    [readings, reflection] = await Promise.all([readReadings(date), readReflection(date)]);
  } catch (e) {
    console.error('readings lookup failed', e instanceof Error ? e.message : e);
    return Response.json({ error: 'Lookup failed' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  // Cache hits for an hour; a not-yet-fetched day only briefly so it appears soon after the job runs.
  const cache = readings ? 'public, s-maxage=3600' : 'public, s-maxage=60';
  return Response.json(
    { day: liturgicalDay(date), readings, reflection, updatedAt: readings?.fetchedAt ?? null },
    { headers: { 'Cache-Control': cache } },
  );
}
