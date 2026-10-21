import { hasBulletin, newestBulletinDate, saveBulletin } from '@/lib/db/bulletins';
import { logRun } from '@/lib/db/jobs';
import { sendAlert } from '@/lib/jobs/alert';
import { runBulletinJob } from '@/lib/jobs/bulletin-job';
import { assertCron } from '@/lib/jobs/cron-auth';
import { bulletinUrl, extractPdfText, fetchBulletinPdf } from '@/lib/sources/bulletins';

export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  const denied = assertCron(req);
  if (denied) return denied;
  const result = await runBulletinJob({
    fetchPdf: fetchBulletinPdf,
    urlFor: bulletinUrl,
    extractText: extractPdfText,
    hasBulletin,
    saveBulletin,
    newestBulletinDate,
    logRun,
    alert: (subject, body) => sendAlert(subject, body, 'bulletin'),
    now: new Date(),
  });
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
