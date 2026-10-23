import 'server-only';
import { addDays, dayOfWeek } from '@/lib/dates';
import { aiFallbackModels, aiModel } from '@/lib/ai/model';
import { createAdminClient } from './admin';
import type { JobName } from './jobs';
import type { DayHealth, HealthReport, JobHealth } from '@/lib/health';

const JOBS: JobName[] = ['readings', 'bulletin', 'sunday-email'];
/** The past week (what the catch-up covers) through the week ahead (what's saved for offline). */
export const HEALTH_BACK = 7;
export const HEALTH_AHEAD = 7;

/** What the jobs last did and what's saved around today. Service role: call only for the signed-in, allowed user. */
export async function healthReport(today: string): Promise<HealthReport> {
  const db = createAdminClient();
  const from = addDays(today, -HEALTH_BACK);
  const to = addDays(today, HEALTH_AHEAD);

  const jobs = await Promise.all(
    JOBS.map(async (job): Promise<JobHealth> => {
      const [last, ok] = await Promise.all([
        db.from('job_runs').select('started_at, status, message').eq('job', job).order('started_at', { ascending: false }).limit(1).maybeSingle(),
        db.from('job_runs').select('started_at').eq('job', job).eq('status', 'ok').order('started_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (last.error) throw new Error(`job_runs ${job}: ${last.error.message}`);
      return {
        job,
        last: last.data ? { at: last.data.started_at, status: last.data.status, message: last.data.message ?? '' } : null,
        lastOk: ok.data?.started_at ?? null,
      };
    }),
  );

  const [readings, reflections, bulletin] = await Promise.all([
    db.from('readings').select('date').gte('date', from).lte('date', to),
    db.from('reflections').select('date, insights, questions').gte('date', from).lte('date', to),
    db.from('bulletins').select('sunday_date, summary, storage_path').order('sunday_date', { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const r of [readings, reflections, bulletin]) if (r.error) throw new Error(r.error.message);

  const saved = new Set((readings.data ?? []).map((r) => r.date as string));
  const refl = new Map((reflections.data ?? []).map((r) => [r.date as string, r]));
  const days: DayHealth[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = refl.get(d);
    days.push({
      date: d,
      readings: saved.has(d),
      reflection: Boolean(r),
      insights: Boolean(r?.insights),
      questions: dayOfWeek(d) === 0 ? Boolean(r?.questions) : null,
    });
  }

  return {
    jobs,
    days,
    bulletin: bulletin.data
      ? { sundayDate: bulletin.data.sunday_date, summary: Boolean(bulletin.data.summary), pdf: Boolean(bulletin.data.storage_path) }
      : null,
    model: aiModel(),
    fallbacks: aiFallbackModels(),
  };
}
