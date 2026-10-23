import { requireUser } from '@/lib/auth/require-user';
import { todayInChicago } from '@/lib/dates';
import { healthReport } from '@/lib/db/health';

/** App health for Settings: the jobs' last runs and what's saved around today. Signed-in user only. */
export async function GET(): Promise<Response> {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  try {
    return Response.json(await healthReport(todayInChicago()), { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    console.error('healthReport failed', e instanceof Error ? e.message : e);
    return Response.json({ error: 'unavailable' }, { status: 500, headers: { 'cache-control': 'no-store' } });
  }
}
