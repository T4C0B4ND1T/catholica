import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { addDays, todayInChicago } from '../../src/lib/dates';
import { usccbUrl } from '../../src/lib/sources/usccb-url';

const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
const seeded = Boolean(url && serviceKey);

// The service worker prefetches the real coming week, so these rows sit on the real current Chicago dates
// (other specs use 2098/2099). Only dates with no row yet are inserted, and only those are deleted afterwards.
const TODAY = todayInChicago();
const WEEK = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i));
const UNCACHED = addDays(TODAY, 30);
const CACHE = 'catholica-v1';

const synthetic = (date: string) => ({
  date,
  feast: `Synthetic Offline Day ${date}`,
  season: 'ordinary',
  color: 'green',
  source_url: 'https://example.invalid/synthetic-offline',
  fetched_at: `${date}T09:00:00Z`,
  sections: [
    { kind: 'reading1', title: 'First Reading', citation: 'Test 1:1', text: `SYNTHETIC OFFLINE FIRST READING ${date}` },
    { kind: 'gospel', title: 'Gospel', citation: 'Test 5:7', text: `SYNTHETIC OFFLINE GOSPEL ${date} (not scripture)` },
  ],
});

type Day = { feast: string; gospel: string };

/** Waits until the worker controls the page and has cached the coming week, `/` and `/mass`. */
async function waitForPrefetch(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const wanted = [...WEEK.map((d) => `/api/readings/${d}`), '/', '/mass'];
  await expect
    .poll(
      () =>
        page.evaluate(
          async ({ cacheName, paths }) => {
            const cache = await caches.open(cacheName);
            const hits = await Promise.all(paths.map((p) => cache.match(p, { ignoreVary: true })));
            return paths.filter((_, i) => !hits[i]);
          },
          { cacheName: CACHE, paths: wanted },
        ),
      { timeout: 30_000 },
    )
    .toEqual([]);
}

/**
 * No signal. `setOffline` alone does not reach requests the service worker makes itself in Chromium, so those are
 * also aborted the way a dropped connection would.
 */
async function goOffline(context: BrowserContext) {
  await context.setOffline(true);
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
}

test.describe('Offline', () => {
  test.describe.configure({ mode: 'serial' });
  let admin: SupabaseClient | undefined;
  let inserted: string[] = [];
  const days = new Map<string, Day>();

  test.beforeAll(async () => {
    if (!seeded) return;
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const existing = await admin.from('readings').select('date').in('date', WEEK);
    if (existing.error) throw existing.error;
    const have = new Set((existing.data ?? []).map((r) => r.date as string));
    const rows = WEEK.filter((d) => !have.has(d)).map(synthetic);
    if (rows.length) {
      const res = await admin.from('readings').insert(rows);
      if (res.error) throw res.error;
    }
    inserted = rows.map((r) => r.date);
    const all = await admin.from('readings').select('date, feast, sections').in('date', WEEK);
    if (all.error) throw all.error;
    for (const r of all.data ?? []) {
      const gospel = (r.sections as { kind: string; text: string }[]).find((s) => s.kind === 'gospel');
      days.set(r.date as string, { feast: r.feast as string, gospel: gospel?.text.slice(0, 40) ?? '' });
    }
    // The uncached date must really have nothing saved for this test to mean anything.
    const far = await admin.from('readings').select('date').eq('date', UNCACHED).maybeSingle();
    if (far.error) throw far.error;
    if (far.data) throw new Error(`${UNCACHED} already has readings; the offline-miss test needs an empty day`);
  });

  test.afterAll(async () => {
    if (!admin || inserted.length === 0) return;
    await admin.from('readings').delete().in('date', inserted);
  });

  test.beforeEach(() => {
    test.skip(!seeded, 'needs SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY');
  });

  test('after one visit, today, the Mass and the coming week load with no signal', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await waitForPrefetch(page);
    const today = days.get(TODAY)!;

    await goOffline(context);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: today.feast })).toBeVisible();
    await expect(page.getByText(today.gospel)).toBeVisible();

    // Tapping through, as in the pew: the app's own links fall back to the saved pages.
    await page.getByRole('link', { name: 'Follow the Mass' }).click();
    await expect(page).toHaveURL(`/mass?date=${TODAY}`);
    await expect(page.locator('#holy-gospel').getByText(today.gospel)).toBeVisible();

    await page.goto('/mass');
    await expect(page.getByRole('heading', { name: 'Order of the Mass' })).toBeVisible();
    await expect(page.locator('#holy-gospel')).toBeVisible();

    // The Mass button on Today links to `/mass?date=today`, prefetched for each day of the week.
    await page.goto(`/mass?date=${TODAY}`);
    await expect(page.getByRole('heading', { name: 'Order of the Mass' })).toBeVisible();
    await expect(page.locator('#holy-gospel').getByText(today.gospel)).toBeVisible();

    // A day later in the week was never opened: rendered from its prefetched readings.
    const later = WEEK[4];
    await page.goto(`/?date=${later}`);
    await expect(page.getByRole('heading', { level: 1, name: days.get(later)!.feast })).toBeVisible();
    await expect(page.getByText(days.get(later)!.gospel)).toBeVisible();

    await page.goto(`/?date=${UNCACHED}`);
    await expect(page.getByText('Not saved for offline. Connect to load, or open USCCB.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'open USCCB' })).toHaveAttribute('href', usccbUrl(UNCACHED));
    expect(errors).toEqual([]);
  });

  test('a stale cached Today page still shows today offline', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await waitForPrefetch(page);
    // Simulate yesterday's visit: store another day's page under `/`.
    const other = WEEK[2];
    await page.evaluate(
      async ({ cacheName, otherDate }) => {
        const cache = await caches.open(cacheName);
        const res = await fetch(`/?date=${otherDate}`);
        await cache.put('/', res);
      },
      { cacheName: CACHE, otherDate: other },
    );
    await goOffline(context);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: days.get(TODAY)!.feast })).toBeVisible();
    await expect(page.getByText(days.get(TODAY)!.gospel)).toBeVisible();
    await expect(page.getByText(days.get(other)!.gospel)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('personal and auth requests are never cached', async ({ page }) => {
    await page.goto('/');
    await waitForPrefetch(page);
    await page.evaluate(() => fetch('/api/me/notes').catch(() => null));
    const keys = await page.evaluate(async (cacheName) => {
      const cache = await caches.open(cacheName);
      return (await cache.keys()).map((r) => new URL(r.url).pathname);
    }, CACHE);
    expect(keys.filter((p) => /^\/(api\/me|api\/cron|auth)\//.test(p))).toEqual([]);
  });
});
