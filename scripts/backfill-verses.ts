/**
 * Adds verse numbers to readings the site already has. Reads each day from the site, finds its verses in USCCB's
 * Bible on this machine (those pages challenge the site's own servers) and uploads them; the site adds them only
 * where the saved text is unchanged.
 * Usage: pnpm tsx scripts/backfill-verses.ts --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run]
 * Needs SITE_URL (e.g. https://catholica-daily.vercel.app), and CRON_SECRET unless --dry-run.
 * --dry-run prints each reading with its verse numbers and uploads nothing. Set BIBLE_CACHE_DIR to keep fetched
 * Bible pages on disk, so a dry run and the real run fetch each chapter once.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const PAUSE_MS = 1500;
const BATCH = 31;
const USAGE = 'usage: pnpm tsx scripts/backfill-verses.ts --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run]';
const UA = 'Mozilla/5.0 (compatible; Catholica verse numbers)';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function arg(argv: string[], name: string): string {
  const v = argv[argv.indexOf(name) + 1];
  if (!argv.includes(name) || !v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`${name} needs a YYYY-MM-DD date\n${USAGE}`);
  return v;
}

const cacheDir = process.env.BIBLE_CACHE_DIR;
if (cacheDir) mkdirSync(cacheDir, { recursive: true });

/** USCCB's pages answer some requests with 403 for a while; wait and try again. */
async function fetchText(url: string): Promise<string> {
  const cached = cacheDir && join(cacheDir, url.replace(/\W+/g, '_'));
  if (cached && existsSync(cached)) return readFileSync(cached, 'utf8');
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const text = await res.text();
      if (cached) writeFileSync(cached, text);
      await sleep(PAUSE_MS);
      return text;
    }
    if (attempt >= 6) throw new Error(`GET ${url} returned ${res.status}`);
    await sleep(3000 * attempt);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const from = arg(argv, '--from');
  const to = arg(argv, '--to');
  const dry = argv.includes('--dry-run');
  const site = process.env.SITE_URL;
  const secret = process.env.CRON_SECRET;
  if (!site || (!dry && !secret)) throw new Error('SITE_URL and CRON_SECRET must be set');

  // 'server-only' throws outside a Next server build; stub it so the shared server modules load under tsx.
  const require = createRequire(__filename);
  const id = require.resolve('server-only');
  require.cache[id] = { id, filename: id, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;
  const { addVerses } = await import('../src/lib/sources/bible');
  const { withVerseLabels } = await import('../src/lib/verses');
  const { addDays } = await import('../src/lib/dates');
  type Day = import('../src/lib/types').DailyReadings;

  // Chapters already fetched, shared across days: the same Gospel and psalm chapters come back often.
  const chapters = new Map<string, Promise<Map<number, string>>>();
  let batch: Day[] = [];
  const upload = async () => {
    if (!batch.length || dry) return void (batch = []);
    const res = await fetch(new URL('/api/cron/readings/import', site), {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify(batch),
    });
    console.log(`upload ${res.status}`, await res.text());
    if (!res.ok) throw new Error('upload failed');
    batch = [];
  };

  for (let date = from; date <= to; date = addDays(date, 1)) {
    try {
      const res = await fetch(new URL(`/api/readings/${date}`, site), { cache: 'no-store' });
      const day = ((await res.json()) as { readings: Day | null }).readings;
      if (!day) {
        console.log(date, 'no readings saved');
        continue;
      }
      if (day.sections.every((s) => s.verses?.length)) {
        console.log(date, 'already numbered');
        continue;
      }
      const sections = await addVerses(day.sections, fetchText, undefined, chapters);
      const found = sections.filter((s) => s.verses?.length).length;
      console.log(date, `verses found for ${found} of ${sections.length} sections`);
      if (dry) for (const s of sections) console.log(`--- ${s.title} | ${s.citation}\n${withVerseLabels(s.text, s.verses)}`);
      if (found) batch.push({ ...day, sections });
    } catch (e) {
      console.error(date, 'failed:', e instanceof Error ? e.message : e);
    }
    if (batch.length >= BATCH) await upload();
  }
  await upload();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
