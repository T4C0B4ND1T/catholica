/**
 * Fetches readings from USCCB on this machine and uploads them to the site, for when USCCB's pages challenge the
 * site's own servers. Days already saved are skipped by the site.
 * Usage: pnpm tsx scripts/seed-readings.ts --from YYYY-MM-DD --to YYYY-MM-DD
 * Needs SITE_URL (e.g. https://catholica-beryl.vercel.app) and CRON_SECRET.
 */
import { createRequire } from 'node:module';

const PAUSE_MS = 2500;
const BATCH = 31;
const USAGE = 'usage: pnpm tsx scripts/seed-readings.ts --from YYYY-MM-DD --to YYYY-MM-DD';
const UA = 'Mozilla/5.0 (compatible; Catholica readings seed)';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function arg(argv: string[], name: string): string {
  const v = argv[argv.indexOf(name) + 1];
  if (!argv.includes(name) || !v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`${name} needs a YYYY-MM-DD date\n${USAGE}`);
  return v;
}

/** USCCB's pages answer some requests with 403 for a while; wait and try again. The feed only holds recent days. */
async function fetchText(url: string): Promise<string> {
  if (url.endsWith('readings.rss')) throw new Error('feed skipped');
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
    if (res.ok) return res.text();
    if (attempt >= 6) throw new Error(`GET ${url} returned ${res.status}`);
    await sleep(4000 * attempt);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const from = arg(argv, '--from');
  const to = arg(argv, '--to');
  const site = process.env.SITE_URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) throw new Error('SITE_URL and CRON_SECRET must be set');

  // 'server-only' throws outside a Next server build; stub it so the shared server modules load under tsx.
  const require = createRequire(__filename);
  const id = require.resolve('server-only');
  require.cache[id] = { id, filename: id, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;
  const { fetchUsccb } = await import('../src/lib/sources/usccb');
  const { addDays } = await import('../src/lib/dates');

  let batch: unknown[] = [];
  const upload = async () => {
    if (!batch.length) return;
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
      batch.push(await fetchUsccb(date, fetchText));
      console.log(date);
    } catch (e) {
      console.error(date, 'failed:', e instanceof Error ? e.message : e);
    }
    if (batch.length >= BATCH) await upload();
    await sleep(PAUSE_MS);
  }
  await upload();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
