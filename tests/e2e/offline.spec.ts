import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { addDays, todayInChicago } from '../../src/lib/dates';
import { usccbUrl } from '../../src/lib/sources/usccb-url';

const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
const seeded = Boolean(url && serviceKey);

// The service worker prefetches the real coming week, so these rows sit on the real current Chicago dates
// (other specs use 2098/2099). Only dates with no row yet are inserted, and only those are deleted afterwards.
// Set in beforeAll, so a run that crosses midnight uses one consistent "today" from setup on.
let TODAY = '';
let WEEK: string[] = [];
let UNCACHED = '';
const CACHE = 'catholica-v1';
// A clearly synthetic bulletin (a Sunday no other spec uses), removed afterwards.
const PDF_SUNDAY = '2097-01-06';
const PDF_PATH = `e2e-synthetic/${PDF_SUNDAY}.pdf`;
/** Smallest file the PDF checks accept: only the `%PDF-` header matters here. */
const SYNTHETIC_PDF = Buffer.from('%PDF-1.4\n% synthetic offline test file\n%%EOF\n', 'latin1');

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

/** Waits until the worker controls the page and has cached the coming week, `/` and today's Mass. */
async function waitForPrefetch(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const wanted = [...WEEK.map((d) => `/api/readings/${d}`), '/', `/mass?date=${TODAY}`];
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
  // The worker runs prefetches in order, so this empty one ends after the app's own, which may still be pruning.
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('message', (e) => e.data?.type === 'prefetch-done' && e.data.id === 'settle' && resolve());
      reg.active!.postMessage({ type: 'prefetch', id: 'settle', urls: [], assets: [], bulletinDate: null });
    });
  });
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
    TODAY = todayInChicago();
    WEEK = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i));
    UNCACHED = addDays(TODAY, 30);
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
    const up = await admin.storage.from('bulletins').upload(PDF_PATH, SYNTHETIC_PDF, { contentType: 'application/pdf', upsert: true });
    if (up.error) throw up.error;
    const bulletin = await admin.from('bulletins').upsert({
      sunday_date: PDF_SUNDAY,
      source_url: 'https://example.invalid/synthetic-offline-bulletin.pdf',
      storage_path: PDF_PATH,
      page_count: 1,
      text: 'synthetic',
    });
    if (bulletin.error) throw bulletin.error;
    // The uncached date must really have nothing saved for this test to mean anything.
    const far = await admin.from('readings').select('date').eq('date', UNCACHED).maybeSingle();
    if (far.error) throw far.error;
    if (far.data) throw new Error(`${UNCACHED} already has readings; the offline-miss test needs an empty day`);
  });

  test.afterAll(async () => {
    if (!admin) return;
    await admin.from('bulletins').delete().eq('sunday_date', PDF_SUNDAY);
    await admin.storage.from('bulletins').remove([PDF_PATH]);
    if (inserted.length) await admin.from('readings').delete().in('date', inserted);
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

  test('a stale cached Mass page still shows today offline', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await waitForPrefetch(page);
    // Simulate an older build or yesterday's visit: another day's Mass stored under bare `/mass`.
    const other = WEEK[2];
    await page.evaluate(
      async ({ cacheName, otherDate }) => {
        const cache = await caches.open(cacheName);
        const res = await fetch(`/mass?date=${otherDate}`);
        await cache.put('/mass', res);
      },
      { cacheName: CACHE, otherDate: other },
    );
    await goOffline(context);
    const today = days.get(TODAY)!;
    const otherGospel = days.get(other)!.gospel;

    await page.goto('/mass');
    await expect(page.locator('#holy-gospel').getByText(today.gospel)).toBeVisible();
    await expect(page.getByText(otherGospel)).toHaveCount(0);

    // The Mass tab links to bare `/mass`: tapping it offline must also land on today.
    await page.goto('/');
    await expect(page.getByText(today.gospel)).toBeVisible();
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Mass' }).click();
    await expect(page.getByRole('heading', { name: 'Order of the Mass' })).toBeVisible();
    await expect(page.locator('#holy-gospel').getByText(today.gospel)).toBeVisible();
    await expect(page.getByText(otherGospel)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a slow connection waits for the real page instead of showing another one', async ({ page, context }) => {
    await page.goto('/');
    await waitForPrefetch(page);
    // /me was never saved. Its response takes longer than the worker's 3-second timeout.
    await context.route('**/me', async (route) => {
      await new Promise((r) => setTimeout(r, 4500));
      await route.continue();
    });
    await page.goto('/me', { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Me' })).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Follow the Mass' })).toHaveCount(0);
  });

  test('an unsaved Mass date offline says so instead of showing another day', async ({ page, context }) => {
    await page.goto('/');
    await waitForPrefetch(page);
    await goOffline(context);
    await page.goto(`/mass?date=${UNCACHED}`);
    await expect(page.getByText('Not saved for offline. Connect to load, or open USCCB.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'open USCCB' })).toHaveAttribute('href', usccbUrl(UNCACHED));
    await expect(page.getByText(days.get(TODAY)!.gospel)).toHaveCount(0);
  });

  test('after a prefetch, past days, older bulletins and old deploys are dropped from the cache', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await waitForPrefetch(page);
    const past = addDays(TODAY, -1);
    const newest = '2000-02-06';
    const old = '2000-01-30';
    const planted = [
      `/api/readings/${past}`,
      `/?date=${past}`,
      `/mass?date=${past}`,
      `/bulletin/${old}`,
      `/api/bulletins/${old}/pdf`,
      // Saved by an older worker: never read now, since bare `/mass` means today.
      '/mass',
      // A previous deploy's script, which no saved page uses any more.
      '/_next/static/chunks/old-deploy-0000.js',
      `/bulletin/${newest}`,
      `/api/bulletins/${newest}/pdf`,
    ];
    const keys = await page.evaluate(
      async ({ cacheName, paths, bulletinDate }) => {
        const cache = await caches.open(cacheName);
        await Promise.all(paths.map((p) => cache.put(p, new Response('planted'))));
        const reg = await navigator.serviceWorker.ready;
        const done = new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener('message', (e) => e.data?.type === 'prefetch-done' && e.data.id === 'e2e' && resolve()),
        );
        // The app's own prefetch can still be running and finish first; wait for this one by its id.
        reg.active!.postMessage({ type: 'prefetch', id: 'e2e', urls: [], assets: [], bulletinDate });
        await done;
        return (await cache.keys()).map((r) => {
          const u = new URL(r.url);
          return u.pathname + u.search;
        });
      },
      { cacheName: CACHE, paths: planted, bulletinDate: newest },
    );
    for (const gone of planted.slice(0, 7)) expect(keys).not.toContain(gone);
    expect(keys).toEqual(expect.arrayContaining([`/bulletin/${newest}`, `/api/bulletins/${newest}/pdf`]));
    // This week's entries stay.
    expect(keys).toEqual(expect.arrayContaining([`/api/readings/${TODAY}`, `/mass?date=${TODAY}`, '/']));
    // The running deploy's scripts stay.
    const scripts = await page.evaluate(() =>
      [...document.scripts]
        .map((s) => (s.src ? new URL(s.src).pathname : ''))
        .filter((p) => p.startsWith('/_next/static/')),
    );
    expect(scripts.length).toBeGreaterThan(0);
    const staticKeys = keys.map((k) => k.split('?')[0]);
    expect(staticKeys).toEqual(expect.arrayContaining(scripts));

    // What the prune kept is enough to start the app offline and tap to the Mass.
    await goOffline(context);
    await page.reload();
    await expect(page.getByText(days.get(TODAY)!.gospel)).toBeVisible();
    await page.getByRole('link', { name: 'Follow the Mass' }).click();
    await expect(page.locator('#holy-gospel').getByText(days.get(TODAY)!.gospel)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a bulletin PDF behind the signed-URL redirect is saved under its own path and opens offline', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const pdfPath = `/api/bulletins/${PDF_SUNDAY}/pdf`;
    await page.goto('/');
    await waitForPrefetch(page);

    // The prefetch the app sends for the newest bulletin: the worker follows the redirect and keeps the file.
    const saved = await page.evaluate(
      async ({ cacheName, path, bulletinDate }) => {
        const reg = await navigator.serviceWorker.ready;
        const done = new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener('message', (e) => e.data?.type === 'prefetch-done' && e.data.id === 'e2e' && resolve()),
        );
        // The app's own prefetch can still be running and finish first; wait for this one by its id.
        reg.active!.postMessage({ type: 'prefetch', id: 'e2e', urls: [path], assets: [], bulletinDate });
        await done;
        const cache = await caches.open(cacheName);
        const res = await cache.match(path);
        if (!res) return null;
        const keys = (await cache.keys()).map((r) => r.url);
        return {
          head: new TextDecoder().decode((await res.arrayBuffer()).slice(0, 5)),
          type: res.headers.get('content-type'),
          redirected: res.redirected,
          signedKeys: keys.filter((k) => k.includes('token=') || k.includes('/storage/')),
        };
      },
      { cacheName: CACHE, path: pdfPath, bulletinDate: PDF_SUNDAY },
    );
    expect(saved).toEqual({ head: '%PDF-', type: 'application/pdf', redirected: false, signedKeys: [] });

    // The viewer, opened once online so its page is saved, then again with no signal.
    await page.goto(`/bulletin/${PDF_SUNDAY}`);
    await expect(page.locator(`iframe[src="${pdfPath}"]`)).toBeVisible();
    await goOffline(context);
    await page.reload();
    await expect(page.locator(`iframe[src="${pdfPath}"]`)).toBeVisible();
    const offline = await page.evaluate(async (path) => {
      const res = await fetch(path);
      return { status: res.status, head: new TextDecoder().decode((await res.arrayBuffer()).slice(0, 5)) };
    }, pdfPath);
    expect(offline).toEqual({ status: 200, head: '%PDF-' });
    // The iframe's navigation can be answered from this entry because it is not `redirected` (asserted above).
    // Whether a frame shows it depends on the browser's PDF viewer, which CI's headless shell lacks.
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
