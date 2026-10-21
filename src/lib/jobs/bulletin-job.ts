import { addDays, dayOfWeek, todayInChicago } from '@/lib/dates';

/** Weeks of history the daily cron re-checks. */
const CRON_WEEKS = 8;

export interface BulletinMeta {
  sundayDate: string;
  sourceUrl: string;
  pageCount: number;
  text: string;
}

export interface BulletinJobDeps {
  /** PDF bytes for a Sunday, null when not posted yet; throws on real failures. */
  fetchPdf: (sunday: string) => Promise<Uint8Array | null>;
  urlFor: (sunday: string) => string;
  extractText: (bytes: Uint8Array) => Promise<{ text: string; pageCount: number }>;
  hasBulletin: (sunday: string) => Promise<boolean>;
  saveBulletin: (meta: BulletinMeta, bytes: Uint8Array) => Promise<void>;
  /** Sunday date of the newest saved bulletin, or null when none. */
  newestBulletinDate: () => Promise<string | null>;
  logRun: (job: 'readings' | 'bulletin', status: 'ok' | 'error', message: string) => Promise<void>;
  alert: (subject: string, body: string) => Promise<void>;
  now: Date;
  /** First Sunday to check (default: 8 weeks before the current Chicago Sunday). */
  since?: string;
  /** Pause after each download attempt, used by the backfill to be polite. */
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The Sundays to probe, oldest first: `since` through the current Sunday (plus the coming one Thu-Sat). */
export function candidateSundays(today: string, since?: string): string[] {
  const dow = dayOfWeek(today);
  const current = addDays(today, -dow);
  const last = dow >= 4 ? addDays(current, 7) : current;
  let start = since ?? addDays(current, -7 * CRON_WEEKS);
  start = addDays(start, (7 - dayOfWeek(start)) % 7);
  const out: string[] = [];
  for (let d = start; d <= last; d = addDays(d, 7)) out.push(d);
  return out;
}

/**
 * Downloads St. Anselm bulletins not yet saved. A date that is not posted is not an error; a failed download is
 * logged and skipped. Alerts when the host is unreachable, or from Monday on when the latest Sunday has no bulletin.
 */
export async function runBulletinJob(deps: BulletinJobDeps): Promise<{ added: string[] }> {
  const today = todayInChicago(deps.now);
  const currentSunday = addDays(today, -dayOfWeek(today));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const added: string[] = [];
  const notes: string[] = [];
  let probes = 0;
  let failures = 0;

  for (const sunday of candidateSundays(today, deps.since)) {
    try {
      if (await deps.hasBulletin(sunday)) continue;
      probes++;
      let bytes: Uint8Array | null;
      try {
        bytes = await deps.fetchPdf(sunday);
      } catch (e) {
        failures++;
        notes.push(`${sunday}: ${errMessage(e)}`);
        continue;
      } finally {
        if (deps.pauseMs) await sleep(deps.pauseMs);
      }
      if (!bytes) continue;
      let text = '';
      let pageCount = 0;
      try {
        ({ text, pageCount } = await deps.extractText(bytes));
      } catch (e) {
        notes.push(`${sunday}: text extraction failed, saved without search text (${errMessage(e)})`);
      }
      await deps.saveBulletin({ sundayDate: sunday, sourceUrl: deps.urlFor(sunday), pageCount, text }, bytes);
      added.push(sunday);
    } catch (e) {
      failures++;
      notes.push(`${sunday}: ${errMessage(e)}`);
    }
  }

  const detail = notes.length ? `; ${notes.join('; ')}` : '';
  const hostDown = probes > 0 && failures === probes;
  let stale = false;
  let newest: string | null = null;
  if (!hostDown) {
    try {
      newest = await deps.newestBulletinDate();
    } catch (e) {
      notes.push(`newest lookup: ${errMessage(e)}`);
    }
    stale = dayOfWeek(today) >= 1 && (newest === null || newest < currentSunday);
  }

  let alertText: [string, string] | null = null;
  if (hostDown) {
    alertText = ['Catholica: bulletin source unreachable', `Every bulletin download failed.\n\n${notes.join('\n')}`];
  } else if (stale) {
    alertText = [
      `Catholica: bulletin for ${currentSunday} is missing`,
      `Newest saved bulletin is ${newest ?? 'none'}; the ${currentSunday} bulletin was not found.${detail}`,
    ];
  }
  if (alertText) {
    try {
      await deps.alert(...alertText);
    } catch (e) {
      notes.push(`alert: ${errMessage(e)}`);
    }
  }

  const summary = `added ${added.length}${added.length ? ` (${added.join(', ')})` : ''}, failed ${failures}${
    notes.length ? `; ${notes.join('; ')}` : ''
  }`;
  try {
    await deps.logRun('bulletin', hostDown ? 'error' : 'ok', summary);
  } catch (e) {
    console.error('logRun failed', errMessage(e));
  }
  return { added };
}
