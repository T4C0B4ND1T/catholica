import { dateParam } from '@/lib/dates';
import { getInsights, getStudy, readReadings, readReflection } from '@/lib/db/readings';
import { liturgicalDay } from '@/lib/liturgical/calendar';

type Ctx = { params: Promise<{ date: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { date } = await params;
  if (!dateParam(date)) return Response.json({ error: 'Invalid date' }, { status: 400 });

  let readings, reflection, insights, study;
  try {
    [readings, reflection, insights, study] = await Promise.all([
      readReadings(date),
      readReflection(date),
      getInsights(date),
      getStudy(date),
    ]);
  } catch (e) {
    console.error('readings lookup failed', e instanceof Error ? e.message : e);
    return Response.json({ error: 'Lookup failed' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  // A complete day is cached for an hour; a day still missing its readings, reflection, insights or study guide only briefly, so what the
  // jobs add appears soon after they run.
  const cache = readings && reflection && insights && study ? 'public, s-maxage=3600' : 'public, s-maxage=60';
  return Response.json(
    { day: liturgicalDay(date), readings, reflection, insights, study, updatedAt: readings?.fetchedAt ?? null },
    { headers: { 'Cache-Control': cache } },
  );
}
