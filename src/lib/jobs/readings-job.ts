import { addDays, dayOfWeek, todayInChicago } from '@/lib/dates';
import type { DailyReadings } from '@/lib/types';

const WINDOW_DAYS = 7;
const MAX_ATTEMPTS = 3;
/**
 * Only a failure for today is urgent enough to email. Future days come from USCCB's pages, which challenge Vercel's
 * servers, and each day turns up in the feed on the morning itself.
 */
const URGENT_DAYS = 0;
/** Waits before the 2nd and 3rd attempts. */
const BACKOFF_MS = [1000, 3000];
const DEFAULT_BUDGET_MS = 240_000;

export interface ReadingsJobDeps {
  fetchUsccb: (date: string) => Promise<DailyReadings>;
  getReadings: (date: string) => Promise<DailyReadings | null>;
  saveReadings: (r: DailyReadings) => Promise<void>;
  saveReflection: (date: string, text: string) => Promise<void>;
  hasReflection: (date: string) => Promise<boolean>;
  writeReflection: (r: DailyReadings) => Promise<string>;
  /** Sunday prep questions, written once per Sunday after its reflection. Left out, no questions are written. */
  questions?: {
    has: (date: string) => Promise<boolean>;
    write: (r: DailyReadings) => Promise<string[]>;
    save: (date: string, questions: string[]) => Promise<void>;
  };
  logRun: (job: 'readings' | 'bulletin', status: 'ok' | 'error', message: string) => Promise<void>;
  alert: (subject: string, body: string) => Promise<void>;
  now: Date;
  /** Pause between fetch attempts (default: real timers). */
  sleep?: (ms: number) => Promise<void>;
  /** Monotonic-ish clock in ms (default Date.now), used for the time budget. */
  clock?: () => number;
  /** Stop starting new dates after this many ms (default 240s; the route allows 300s). */
  budgetMs?: number;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Ensures readings (and one AI reflection each) exist for today through today + 7.
 * Each missing date gets up to three fetch attempts per run. Sundays also get prep questions.
 * Reflection and question trouble never blocks readings.
 */
export async function runReadingsJob(deps: ReadingsJobDeps): Promise<{ saved: string[]; failed: string[] }> {
  const today = todayInChicago(deps.now);
  const saved: string[] = [];
  const failed: string[] = [];
  const notes: string[] = [];
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const clock = deps.clock ?? Date.now;
  const budgetMs = deps.budgetMs ?? DEFAULT_BUDGET_MS;
  const started = clock();

  for (let i = 0; i <= WINDOW_DAYS; i++) {
    const date = addDays(today, i);
    if (clock() - started > budgetMs) {
      failed.push(date);
      notes.push(`readings ${date}: skipped, time budget exceeded`);
      continue;
    }
    try {
      let readings = await deps.getReadings(date);

      if (!readings) {
        let lastError: unknown;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !readings; attempt++) {
          if (attempt > 1) await sleep(BACKOFF_MS[attempt - 2]);
          try {
            readings = await deps.fetchUsccb(date);
          } catch (e) {
            lastError = e;
          }
        }
        if (!readings) throw lastError ?? new Error('no readings returned');
        await deps.saveReadings(readings);
        saved.push(date);
      }

      try {
        if (!(await deps.hasReflection(date))) {
          await deps.saveReflection(date, await deps.writeReflection(readings));
        }
        const q = deps.questions;
        if (q && dayOfWeek(date) === 0 && !(await q.has(date))) {
          await q.save(date, await q.write(readings));
        }
      } catch (e) {
        notes.push(`reflection ${date}: ${errMessage(e)}`);
      }
    } catch (e) {
      failed.push(date);
      notes.push(`readings ${date}: ${errMessage(e)}`);
    }
  }

  const urgent = failed.filter((d) => d <= addDays(today, URGENT_DAYS));
  if (urgent.length > 0) {
    try {
      await deps.alert(
        `Catholica: readings missing for ${urgent.join(', ')}`,
        `The readings job could not fetch ${urgent.join(', ')}.\n\n${notes.join('\n')}`,
      );
    } catch (e) {
      notes.push(`alert: ${errMessage(e)}`);
    }
  }

  const summary = `saved ${saved.length}, failed ${failed.length}${notes.length ? `; ${notes.join('; ')}` : ''}`;
  try {
    await deps.logRun('readings', failed.length > 0 ? 'error' : 'ok', summary);
  } catch (e) {
    console.error('logRun failed', errMessage(e));
  }
  return { saved, failed };
}
