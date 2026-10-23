import { formatDay } from '@/lib/dates';

export type HealthJob = 'readings' | 'bulletin' | 'sunday-email';

export interface JobHealth {
  job: HealthJob;
  last: { at: string; status: 'ok' | 'error'; message: string } | null;
  lastOk: string | null;
}

export interface DayHealth {
  date: string;
  readings: boolean;
  reflection: boolean;
  insights: boolean;
  /** Sundays only. */
  questions: boolean | null;
}

export interface HealthReport {
  jobs: JobHealth[];
  days: DayHealth[];
  bulletin: { sundayDate: string; summary: boolean; pdf: boolean } | null;
  model: string;
  fallbacks: string[];
}

const JOB_LABELS: Record<HealthJob, string> = { readings: 'Readings', bulletin: 'Bulletin', 'sunday-email': 'Saturday email' };
export const jobLabel = (job: HealthJob) => JOB_LABELS[job];

/** Hours a daily job may go without a good run before it is flagged (a day plus Vercel's hour of cron slack). */
const DAILY_STALE_H = 26;

/** Plain-language problems in a health report; empty when everything is in order. */
export function healthProblems(r: HealthReport, today: string, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (const j of r.jobs) {
    if (j.job === 'sunday-email') {
      if (j.last?.status === 'error') out.push(`The last Saturday email wasn't sent: ${j.last.message}`);
      continue;
    }
    const hours = j.lastOk ? (now.getTime() - new Date(j.lastOk).getTime()) / 3_600_000 : Infinity;
    if (j.job === 'readings' && hours > DAILY_STALE_H) out.push('The readings job hasn’t finished cleanly in over a day.');
    if (j.job === 'bulletin' && hours > DAILY_STALE_H) out.push('The bulletin job hasn’t finished cleanly in over a day.');
  }
  const ahead = r.days.filter((d) => d.date >= today);
  const noReadings = ahead.filter((d) => !d.readings).map((d) => formatDay(d.date));
  if (noReadings.length) out.push(`Readings missing for ${noReadings.join(', ')}.`);
  const noReflection = r.days.filter((d) => d.readings && !d.reflection).map((d) => formatDay(d.date));
  if (noReflection.length) out.push(`Reflection missing for ${noReflection.join(', ')}.`);
  const noQuestions = ahead.filter((d) => d.readings && d.questions === false).map((d) => formatDay(d.date));
  if (noQuestions.length) out.push(`Sunday questions missing for ${noQuestions.join(', ')}.`);
  if (r.bulletin && !r.bulletin.summary) out.push(`The ${formatDay(r.bulletin.sundayDate)} bulletin has no summary yet.`);
  return out;
}
