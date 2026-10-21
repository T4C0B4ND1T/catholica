/**
 * Saves the raw HTML of USCCB daily-readings pages for the given dates to tests/fixtures/usccb/.
 * Usage: pnpm tsx scripts/capture-fixtures.ts 2026-10-25 2026-10-21
 * USCCB answers 403 intermittently and requires a User-Agent, so each page is retried.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { usccbUrl } from '../src/lib/sources/usccb-url';

const UA = 'Catholica/1.0 (personal use)';
const ATTEMPTS = 5;

async function capture(url: string): Promise<string> {
  let last = '';
  for (let i = 1; i <= ATTEMPTS; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15_000) }).catch(
      (e: Error) => e,
    );
    if (res instanceof Response && res.ok) return res.text();
    last = res instanceof Response ? `HTTP ${res.status}` : res.message;
    await new Promise((r) => setTimeout(r, 1000 * i));
  }
  throw new Error(`${url}: ${last} after ${ATTEMPTS} attempts`);
}

async function main(): Promise<void> {
  const dates = process.argv.slice(2);
  if (!dates.length) throw new Error('usage: capture-fixtures.ts <YYYY-MM-DD>...');
  const dir = join(__dirname, '../tests/fixtures/usccb');
  await mkdir(dir, { recursive: true });
  for (const date of dates) {
    const file = join(dir, `${date}.html`);
    await writeFile(file, await capture(usccbUrl(date)));
    console.log(`saved ${file}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
