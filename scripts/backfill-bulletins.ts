/**
 * Downloads every St. Anselm bulletin not yet saved, from --since (default 2023-08-06) to the current Sunday.
 * Usage: pnpm tsx scripts/backfill-bulletins.ts [--since YYYY-MM-DD]
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. from .env.local) and writes to that database.
 */
import { createRequire } from 'node:module';

const DEFAULT_SINCE = '2023-08-06';
const PAUSE_MS = 2000;
const USAGE = 'usage: pnpm tsx scripts/backfill-bulletins.ts [--since YYYY-MM-DD]';

function parseSince(argv: string[]): string {
  const i = argv.indexOf('--since');
  if (i === -1) return DEFAULT_SINCE;
  const v = argv[i + 1];
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`--since needs a YYYY-MM-DD date\n${USAGE}`);
  return v;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return;
  }
  const since = parseSince(argv);
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[key]) throw new Error(`${key} is not set (the backfill writes to that Supabase project)`);
  }

  // 'server-only' throws outside a Next server build; stub it so the shared server modules load under tsx.
  const require = createRequire(__filename);
  const id = require.resolve('server-only');
  require.cache[id] = { id, filename: id, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

  const { hasBulletin, newestBulletinDate, saveBulletin } = await import('../src/lib/db/bulletins');
  const { logRun } = await import('../src/lib/db/jobs');
  const { runBulletinJob } = await import('../src/lib/jobs/bulletin-job');
  const { bulletinUrl, extractPdfText, fetchBulletinPdf } = await import('../src/lib/sources/bulletins');

  const { added } = await runBulletinJob({
    fetchPdf: async (d) => {
      console.log(`checking ${d}`);
      return fetchBulletinPdf(d);
    },
    urlFor: bulletinUrl,
    extractText: extractPdfText,
    hasBulletin,
    saveBulletin: async (meta, bytes) => {
      await saveBulletin(meta, bytes);
      console.log(`saved ${meta.sundayDate} (${meta.pageCount} pages)`);
    },
    newestBulletinDate,
    logRun,
    alert: async (subject, body) => console.error(`ALERT: ${subject}\n${body}`),
    now: new Date(),
    since,
    pauseMs: PAUSE_MS,
  });
  console.log(`done: ${added.length} bulletin(s) added`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
