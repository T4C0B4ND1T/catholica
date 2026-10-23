import { latestBulletin, getBulletinSummary } from '@/lib/db/bulletins';
import { logRun } from '@/lib/db/jobs';
import { getQuestions, getReadings, getReflection } from '@/lib/db/readings';
import { sendSundayEmail } from '@/lib/jobs/alert';
import { assertCron } from '@/lib/jobs/cron-auth';
import { runSundayEmailJob } from '@/lib/jobs/sunday-email';

export const maxDuration = 60;

/** Saturday morning: emails the coming Sunday's prep (readings, Gospel, reflection, questions, bulletin times). */
export async function GET(req: Request): Promise<Response> {
  const denied = assertCron(req);
  if (denied) return denied;
  const result = await runSundayEmailJob({
    getReadings,
    getReflection,
    getQuestions,
    latestBulletin,
    getBulletinSummary,
    send: sendSundayEmail,
    logRun,
    siteUrl: process.env.SITE_URL || 'https://catholica-daily.vercel.app',
    now: new Date(),
  });
  return Response.json(result, { status: result.status === 'error' ? 500 : 200, headers: { 'Cache-Control': 'no-store' } });
}
