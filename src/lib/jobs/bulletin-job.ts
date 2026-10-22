import { addDays, dayOfWeek, todayInChicago } from '@/lib/dates';
import type { BulletinSummary } from '@/lib/types';

/** Weeks of history the daily cron re-checks. */
const CRON_WEEKS = 8;
/** Stored PDFs older than this many weeks are deleted (the row, text and summary stay; the parish keeps its copy). */
export const KEEP_PDF_WEEKS = 12;
/** AI summaries written per run, newest bulletins first, so one run stays well inside the time limit. */
const SUMMARIES_PER_RUN = 3;

export interface BulletinMeta {
  sundayDate: string;
  sourceUrl: string;
  pageCount: number;
  /** null when extraction failed, so a later re-extract can find the row. */
  text: string | null;
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
  /** AI summaries of bulletin text. Left out, none are written. Failures are noted, never fatal. */
  summaries?: {
    missing: (limit: number) => Promise<{ sundayDate: string; text: string }[]>;
    summarize: (text: string) => Promise<BulletinSummary>;
    save: (sunday: string, summary: BulletinSummary) => Promise<void>;
  };
  /** Deletes stored PDFs older than KEEP_PDF_WEEKS. Left out, nothing is deleted. Failures are noted, never fatal. */
  prune?: {
    storedBefore: (before: string) => Promise<{ sundayDate: string; storagePath: string }[]>;
    drop: (sunday: string, storagePath: string) => Promise<void>;
  };
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
export interface BulletinJobResult {
  added: string[];
  summarized: string[];
  /** Sundays whose stored PDF was deleted this run. */
  pruned: string[];
  failures: number;
  /** 'error' when the database failed or every download failed (the run logged as an error). */
  status: 'ok' | 'error';
}

export async function runBulletinJob(deps: BulletinJobDeps): Promise<BulletinJobResult> {
  const today = todayInChicago(deps.now);
  const currentSunday = addDays(today, -dayOfWeek(today));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const added: string[] = [];
  const notes: string[] = [];
  let probes = 0;
  let fetchFailures = 0;
  let dbFailures = 0;

  for (const sunday of candidateSundays(today, deps.since)) {
    let have: boolean;
    try {
      have = await deps.hasBulletin(sunday);
    } catch (e) {
      dbFailures++;
      notes.push(`${sunday}: ${errMessage(e)}`);
      continue;
    }
    if (have) continue;
    probes++;
    let bytes: Uint8Array | null;
    try {
      bytes = await deps.fetchPdf(sunday);
    } catch (e) {
      fetchFailures++;
      notes.push(`${sunday}: ${errMessage(e)}`);
      continue;
    } finally {
      if (deps.pauseMs) await sleep(deps.pauseMs);
    }
    if (!bytes) continue;
    let text: string | null = null;
    let pageCount = 0;
    try {
      ({ text, pageCount } = await deps.extractText(bytes));
    } catch (e) {
      notes.push(`${sunday}: text extraction failed, saved without search text (${errMessage(e)})`);
    }
    try {
      await deps.saveBulletin({ sundayDate: sunday, sourceUrl: deps.urlFor(sunday), pageCount, text }, bytes);
      added.push(sunday);
    } catch (e) {
      dbFailures++;
      notes.push(`${sunday}: ${errMessage(e)}`);
    }
  }

  const summarized: string[] = [];
  if (deps.summaries) {
    try {
      for (const b of await deps.summaries.missing(SUMMARIES_PER_RUN)) {
        try {
          await deps.summaries.save(b.sundayDate, await deps.summaries.summarize(b.text));
          summarized.push(b.sundayDate);
        } catch (e) {
          notes.push(`summary ${b.sundayDate}: ${errMessage(e)}`);
        }
      }
    } catch (e) {
      notes.push(`summary lookup: ${errMessage(e)}`);
    }
  }

  const pruned: string[] = [];
  if (deps.prune) {
    try {
      for (const b of await deps.prune.storedBefore(addDays(currentSunday, -7 * KEEP_PDF_WEEKS))) {
        try {
          await deps.prune.drop(b.sundayDate, b.storagePath);
          pruned.push(b.sundayDate);
        } catch (e) {
          notes.push(`prune ${b.sundayDate}: ${errMessage(e)}`);
        }
      }
    } catch (e) {
      notes.push(`prune lookup: ${errMessage(e)}`);
    }
  }

  let newest: string | null = null;
  try {
    newest = await deps.newestBulletinDate();
  } catch (e) {
    dbFailures++;
    notes.push(`newest lookup: ${errMessage(e)}`);
  }
  const failures = fetchFailures + dbFailures;
  const hostDown = probes > 0 && fetchFailures === probes;
  const dbDown = dbFailures > 0;
  const stale = !dbDown && dayOfWeek(today) === 1 && (newest === null || newest < currentSunday);

  let alertText: [string, string] | null = null;
  if (dbDown) {
    alertText = ['Catholica: bulletin job database error', `Database calls failed.\n\n${notes.join('\n')}`];
  } else if (hostDown) {
    alertText = ['Catholica: bulletin source unreachable', `Every bulletin download failed.\n\n${notes.join('\n')}`];
  } else if (stale) {
    alertText = [
      `Catholica: bulletin for ${currentSunday} is missing`,
      `Newest saved bulletin is ${newest ?? 'none'}; the ${currentSunday} bulletin was not found.${notes.length ? `\n\n${notes.join('\n')}` : ''}`,
    ];
  }
  if (alertText) {
    try {
      await deps.alert(...alertText);
    } catch (e) {
      notes.push(`alert: ${errMessage(e)}`);
    }
  }

  const summary = `added ${added.length}${added.length ? ` (${added.join(', ')})` : ''}, summarized ${summarized.length}, pruned ${pruned.length}, failed ${failures}${
    notes.length ? `; ${notes.join('; ')}` : ''
  }`;
  const status = hostDown || dbDown ? 'error' : 'ok';
  try {
    await deps.logRun('bulletin', status, summary);
  } catch (e) {
    console.error('logRun failed', errMessage(e));
  }
  return { added, summarized, pruned, failures, status };
}
