import { addDays, todayInChicago } from '@/lib/dates';
import type { DailyReadings } from '@/lib/types';

const WINDOW_DAYS = 7;
const MAX_ATTEMPTS = 3;
/** Failures for today or tomorrow are urgent enough to email. */
const URGENT_DAYS = 1;

export interface ReadingsJobDeps {
  fetchUsccb: (date: string) => Promise<DailyReadings>;
  getReadings: (date: string) => Promise<DailyReadings | null>;
  saveReadings: (r: DailyReadings) => Promise<void>;
  saveReflection: (date: string, text: string) => Promise<void>;
  hasReflection: (date: string) => Promise<boolean>;
  writeReflection: (r: DailyReadings) => Promise<string>;
  logRun: (job: 'readings' | 'bulletin', status: 'ok' | 'error', message: string) => Promise<void>;
  alert: (subject: string, body: string) => Promise<void>;
  now: Date;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Ensures readings (and one AI reflection each) exist for today through today + 7.
 * Each missing date gets up to three fetch attempts per run. Reflection trouble never blocks readings.
 */
export async function runReadingsJob(deps: ReadingsJobDeps): Promise<{ saved: string[]; failed: string[] }> {
  const today = todayInChicago(deps.now);
  const saved: string[] = [];
  const failed: string[] = [];
  const notes: string[] = [];

  for (let i = 0; i <= WINDOW_DAYS; i++) {
    const date = addDays(today, i);
    try {
      let readings = await deps.getReadings(date);

      if (!readings) {
        let lastError: unknown;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !readings; attempt++) {
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
