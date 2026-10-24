import { addDays, dayOfWeek, todayInChicago } from '@/lib/dates';
import { comingSunday } from '@/lib/liturgical/calendar';
import type { DailyReadings, ReflectionInsights, StudyGuide, StudyLevel } from '@/lib/types';

const WINDOW_DAYS = 7;
const MAX_ATTEMPTS = 3;
/** Days before today whose missing reflections, insights and questions are retried. */
const LOOKBACK_DAYS = 7;
/**
 * Only a failure for today is urgent enough to email. Future days come from USCCB's pages, which challenge Vercel's
 * servers, and each day turns up in the feed on the morning itself.
 */
const URGENT_DAYS = 0;
/** Waits before the 2nd and 3rd attempts. */
const BACKOFF_MS = [1000, 3000];
const DEFAULT_BUDGET_MS = 150_000;

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
  /** The theology insight, Catechism connections and prayer prompt, written once per date after its reflection. */
  insights?: {
    has: (date: string) => Promise<boolean>;
    write: (r: DailyReadings) => Promise<ReflectionInsights>;
    save: (date: string, insights: ReflectionInsights) => Promise<void>;
  };
  /**
   * The study guide for each reading, written after the reflection. A day in the coming week whose stored guide is at
   * another level than `level` wants (the reader changed their depth setting) is written again.
   */
  study?: {
    level: (date: string) => StudyLevel;
    stored: (date: string) => Promise<StudyLevel | null>;
    write: (r: DailyReadings, level: StudyLevel) => Promise<StudyGuide>;
    save: (date: string, study: StudyGuide) => Promise<void>;
  };
  /** The reader's personal reflection, written for today and the coming Sunday when missing. */
  personal?: {
    has: (date: string) => Promise<boolean>;
    write: (r: DailyReadings) => Promise<void>;
  };
  logRun: (job: 'readings' | 'bulletin', status: 'ok' | 'error', message: string) => Promise<void>;
  alert: (subject: string, body: string) => Promise<void>;
  now: Date;
  /** Pause between fetch attempts (default: real timers). */
  sleep?: (ms: number) => Promise<void>;
  /** Monotonic-ish clock in ms (default Date.now), used for the time budget. */
  clock?: () => number;
  /** Stop starting new dates after this many ms (default 150s; the route allows 300s, and an AI step started just before the budget runs out can take two minutes when it falls back to a second model). */
  budgetMs?: number;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Ensures readings (and one AI reflection and set of insights each) exist for today through today + 7.
 * Each missing date gets up to three fetch attempts per run. Sundays also get prep questions. Time left over goes
 * to the past week's missing AI pieces.
 * Reflection, insight and question trouble never blocks readings.
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

  /**
   * Writes whatever AI pieces `date` lacks: the reflection, then its insights and study guide, on a Sunday the prep
   * questions, and for today and the coming Sunday the reader's personal reflection. Only `ahead` days (today on)
   * rewrite a study guide at another level or get a personal reflection.
   */
  const fillAi = async (date: string, readings: DailyReadings, ahead: boolean): Promise<boolean> => {
    let wrote = false;
    try {
      // Each AI step can take up to 2 minutes (60s per model), so none starts once the budget is spent; the next run picks them up.
      if (clock() - started > budgetMs) throw new Error('AI skipped, time budget exceeded');
      if (!(await deps.hasReflection(date))) {
        await deps.saveReflection(date, await deps.writeReflection(readings));
        wrote = true;
      }
      // The insights go on the reflection row, so they wait for a reflection; their trouble never stops the questions.
      const ins = deps.insights;
      if (ins && clock() - started <= budgetMs && (await deps.hasReflection(date)) && !(await ins.has(date))) {
        try {
          await ins.save(date, await ins.write(readings));
          wrote = true;
        } catch (e) {
          notes.push(`insights ${date}: ${errMessage(e)}`);
        }
      }
      const st = deps.study;
      if (st && clock() - started <= budgetMs && (await deps.hasReflection(date))) {
        try {
          const want = st.level(date);
          const have = await st.stored(date);
          if (have === null || (ahead && have !== want)) {
            await st.save(date, await st.write(readings, want));
            wrote = true;
          }
        } catch (e) {
          notes.push(`study ${date}: ${errMessage(e)}`);
        }
      }
      const p = deps.personal;
      const personalDay = date === today || date === comingSunday(today);
      if (p && ahead && personalDay && clock() - started <= budgetMs) {
        try {
          if (!(await p.has(date))) {
            await p.write(readings);
            wrote = true;
          }
        } catch (e) {
          notes.push(`personal ${date}: ${errMessage(e)}`);
        }
      }
      const q = deps.questions;
      if (q && clock() - started <= budgetMs && dayOfWeek(date) === 0 && !(await q.has(date))) {
        await q.save(date, await q.write(readings));
        wrote = true;
      }
    } catch (e) {
      notes.push(`reflection ${date}: ${errMessage(e)}`);
    }
    return wrote;
  };

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

      await fillAi(date, readings, true);
    } catch (e) {
      failed.push(date);
      notes.push(`readings ${date}: ${errMessage(e)}`);
    }
  }

  // Catch-up: earlier days whose AI pieces failed on their own run get another try with the time left.
  const caughtUp: string[] = [];
  for (let i = 1; i <= LOOKBACK_DAYS && clock() - started <= budgetMs; i++) {
    const date = addDays(today, -i);
    try {
      const readings = await deps.getReadings(date);
      if (readings && (await fillAi(date, readings, false))) caughtUp.push(date);
    } catch (e) {
      notes.push(`catch-up ${date}: ${errMessage(e)}`);
    }
  }
  if (caughtUp.length) notes.push(`caught up AI for ${caughtUp.join(', ')}`);

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
