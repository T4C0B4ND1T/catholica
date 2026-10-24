import { latestBulletin, getBulletinSummary } from '@/lib/db/bulletins';
import { createAdminClient } from '@/lib/db/admin';
import { logRun } from '@/lib/db/jobs';
import { allowedReader, readPersonal } from '@/lib/db/personal';
import { getInsights, getQuestions, getReadings, getReflection, getStudy } from '@/lib/db/readings';
import { sendSundayEmail } from '@/lib/jobs/alert';
import { assertCron } from '@/lib/jobs/cron-auth';
import { runSundayEmailJob } from '@/lib/jobs/sunday-email';

export const maxDuration = 60;

/** The allowed reader's personal reflection for the date (the email goes to them), or null. */
async function getPersonal(date: string): Promise<string | null> {
  const reader = await allowedReader();
  return reader ? ((await readPersonal(createAdminClient(), reader.id, date))?.text ?? null) : null;
}

/** Saturday morning: emails the coming Sunday's prep (readings with study notes, homily, questions, bulletin times). */
export async function GET(req: Request): Promise<Response> {
  const denied = assertCron(req);
  if (denied) return denied;
  const result = await runSundayEmailJob({
    getReadings,
    getReflection,
    getQuestions,
    getInsights,
    getStudy,
    getPersonal,
    latestBulletin,
    getBulletinSummary,
    send: sendSundayEmail,
    logRun,
    siteUrl: process.env.SITE_URL || 'https://catholica-daily.vercel.app',
    now: new Date(),
  });
  return Response.json(result, { status: result.status === 'error' ? 500 : 200, headers: { 'Cache-Control': 'no-store' } });
}
