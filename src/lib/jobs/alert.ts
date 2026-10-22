import 'server-only';
import { Resend } from 'resend';
import { logRun } from '@/lib/db/jobs';

/** Emails ALERT_EMAIL. Without RESEND_API_KEY (or ALERT_EMAIL) the alert is only recorded in job_runs. */
export async function sendAlert(subject: string, body: string, job: 'readings' | 'bulletin' = 'readings'): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  if (!key || !to) {
    await logRun(job, 'error', `ALERT (not emailed): ${subject}\n${body}`);
    return;
  }
  const { error } = await new Resend(key).emails.send({
    from: 'Catholica <onboarding@resend.dev>',
    to,
    subject,
    text: body,
  });
  if (error) throw new Error(`Resend failed: ${error.message}`);
}
