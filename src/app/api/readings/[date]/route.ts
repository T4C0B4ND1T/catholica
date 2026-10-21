import { getReadings, getReflection } from '@/lib/db/readings';
import { liturgicalDay } from '@/lib/liturgical/calendar';

type Ctx = { params: Promise<{ date: string }> };

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
}

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { date } = await params;
  if (!validDate(date)) return Response.json({ error: 'Invalid date' }, { status: 400 });
  const [readings, reflection] = await Promise.all([getReadings(date), getReflection(date)]);
  return Response.json(
    { day: liturgicalDay(date), readings, reflection, updatedAt: readings?.fetchedAt ?? null },
    { headers: { 'Cache-Control': 'public, s-maxage=3600' } },
  );
}
