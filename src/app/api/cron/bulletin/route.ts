import { summarizeBulletin } from '@/lib/ai/writer';
import {
  bulletinsMissingSummary,
  dropStoredPdf,
  hasBulletin,
  newestBulletinDate,
  saveBulletin,
  saveBulletinSummary,
  storedPdfsBefore,
} from '@/lib/db/bulletins';
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
    summaries: { missing: bulletinsMissingSummary, summarize: summarizeBulletin, save: saveBulletinSummary },
    prune: { storedBefore: storedPdfsBefore, drop: dropStoredPdf },
  });
  // A failed run is a 500 so the Vercel cron dashboard shows it; the body is the same JSON either way.
  return Response.json(result, { status: result.status === 'error' ? 500 : 200, headers: { 'Cache-Control': 'no-store' } });
}
