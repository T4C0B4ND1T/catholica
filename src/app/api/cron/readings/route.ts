import { writeReflection } from '@/lib/ai/gemini';
import { logRun } from '@/lib/db/jobs';
import { getReadings, hasReflection, saveReadings, saveReflection } from '@/lib/db/readings';
import { sendAlert } from '@/lib/jobs/alert';
import { assertCron } from '@/lib/jobs/cron-auth';
import { runReadingsJob } from '@/lib/jobs/readings-job';
import { fetchUsccb } from '@/lib/sources/usccb';

export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  const denied = assertCron(req);
  if (denied) return denied;
  const result = await runReadingsJob({
    fetchUsccb,
    getReadings,
    saveReadings,
    saveReflection,
    hasReflection,
    writeReflection,
    logRun,
    alert: sendAlert,
    now: new Date(),
  });
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
