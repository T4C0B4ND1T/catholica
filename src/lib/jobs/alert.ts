import 'server-only';
import { Resend } from 'resend';
import { logRun } from '@/lib/db/jobs';

const FROM = 'Catholica <onboarding@resend.dev>';

/** Emails ALERT_EMAIL. Without RESEND_API_KEY (or ALERT_EMAIL) the alert is only recorded in job_runs. */
export async function sendAlert(subject: string, body: string, job: 'readings' | 'bulletin' = 'readings'): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  if (!key || !to) {
    await logRun(job, 'error', `ALERT (not emailed): ${subject}\n${body}`);
    return;
  }
  const { error } = await new Resend(key).emails.send({
    from: FROM,
    to,
    subject,
    text: body,
  });
  if (error) throw new Error(`Resend failed: ${error.message}`);
}

/**
 * Sends the Saturday Sunday-prep email to SUNDAY_EMAIL (or ALERT_EMAIL). False, without sending, when Resend or an
 * address isn't set. Resend's shared sender only delivers to the Resend account's own address.
 */
export async function sendSundayEmail(email: { subject: string; text: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.SUNDAY_EMAIL || process.env.ALERT_EMAIL;
  if (!key || !to) return false;
  const { error } = await new Resend(key).emails.send({ from: FROM, to, ...email });
  if (error) throw new Error(`Resend failed: ${error.message}`);
  return true;
}
