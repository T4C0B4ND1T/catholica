/* Catholica service worker: keeps the coming week readable with no signal. */
/* global self, caches, fetch, Response, URL */

// Bump to drop every cached response on the next activation.
const CACHE = 'catholica-v1';
const NAV_TIMEOUT_MS = 3000;
// A prefetch skips a URL cached this recently (the server's Date header), so repeat app opens stay light.
const PREFETCH_FRESH_MS = 15 * 60 * 1000;

const NEVER = [/^\/api\/me(\/|$)/, /^\/api\/cron(\/|$)/, /^\/auth(\/|$)/];
const STALE_WHILE_REVALIDATE = [/^\/api\/readings\/[^/]+$/];
const PDF = /^\/api\/bulletins\/[^/]+\/pdf$/;
const STATIC = /^\/_next\/static\//;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('catholica-') && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function never(path) {
  return NEVER.some((re) => re.test(path));
}

/** Only complete 200s are kept; API responses marked no-store (the 503 path) are not. Page HTML from Next is always
 * no-store, so for pages that header is ignored on purpose: the offline copy is the point. */
function cacheable(res, isPage) {
  if (!res || res.status !== 200 || res.type !== 'basic' || res.redirected) return false;
  if (!isPage && /no-store/i.test(res.headers.get('Cache-Control') || '')) return false;
  return true;
}

async function store(key, res, isPage) {
  if (!cacheable(res, isPage)) return;
  const cache = await caches.open(CACHE);
  await cache.put(key, res);
}

/** Saves a rebuilt bulletin PDF (see fetchPdf). Built in the worker, so it is not a 'basic' network response. */
async function storePdf(key, res) {
  const cache = await caches.open(CACHE);
  await cache.put(key, res);
}

function match(key, options) {
  return caches.open(CACHE).then((c) => c.match(key, { ignoreVary: true, ...options }));
}

/** Today's date in Chicago, as the app computes it. */
function todayInChicago() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** MMDDYY, as in USCCB reading URLs. */
function usccbUrl(date) {
  const [y, m, d] = date.split('-');
  return `https://bible.usccb.org/bible/readings/${m}${d}${y.slice(2)}.cfm`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** The date itself if a Sunday, else the next Sunday (as comingSunday in the app). */
function comingSunday(date) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

/** A plain page for a Mass or Sunday prep date with nothing saved: never another day's scripture. */
function notSavedPage(date, title = 'Order of the Mass') {
  const href = escapeHtml(usccbUrl(date));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>Catholica</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 34em; margin: 0 auto; padding: 32px 16px; line-height: 1.6; text-align: center">
<h1 style="font-family: Georgia, serif; font-weight: normal">${escapeHtml(title)}</h1>
<p data-testid="no-readings">Not saved for offline. Connect to load, or <a href="${href}" style="display: inline-flex; min-height: 44px; align-items: center">open USCCB</a>.</p>
<p><a href="/" style="display: inline-flex; min-height: 44px; align-items: center">Back to Today</a></p>
</body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

/**
 * The cache key for a page. Bare `/mass` means today's Mass, so it is always read and saved as
 * `/mass?date=<today>`: a copy saved under `/mass` on an earlier day would show that day's scripture.
 * Bare `/sunday` likewise means the coming Sunday.
 */
function pageKey(url) {
  if ((url.pathname === '/mass' || url.pathname === '/sunday') && !url.searchParams.has('date')) {
    const dated = new URL(url.href);
    const today = todayInChicago();
    dated.searchParams.set('date', url.pathname === '/sunday' ? comingSunday(today) : today);
    return dated.href;
  }
  return url.href;
}

/**
 * The page to show when the network is unreachable.
 * - Exact URL first, always (bare `/mass` counts as `/mass?date=<today>`).
 * - `/mass?date=X` and `/sunday?date=X`: nothing else (another day would show the wrong scripture), so a plain
 *   "not saved" page.
 * - Anything else, including `/?date=X`: the `/` shell. The Today page then re-renders itself from the cached
 *   `/api/readings/X`, or says "Not saved for offline", so it never shows another day either.
 */
async function offlinePage(url) {
  const exact = await match(pageKey(url));
  if (exact) return exact;
  if (url.pathname === '/mass' || url.pathname === '/sunday') {
    const date = url.searchParams.get('date');
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayInChicago();
    return url.pathname === '/mass' ? notSavedPage(day) : notSavedPage(comingSunday(day), 'Sunday prep');
  }
  if (url.pathname !== '/') {
    const samePage = await match(url.pathname, { ignoreSearch: true });
    if (samePage) return samePage;
  }
  return match('/');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Network first. After 3 seconds an exact cached copy is shown; with none, it keeps waiting for the network, so a
 * slow connection never swaps in a different page. Broader fallbacks only when the fetch actually fails.
 * The network answer still refreshes the cache.
 */
async function page(event, url) {
  const key = pageKey(url);
  const network = fetch(event.request);
  event.waitUntil(network.then((res) => store(key, res.clone(), true)).catch(() => {}));
  const slow = delay(NAV_TIMEOUT_MS).then(() => 'slow');
  try {
    const first = await Promise.race([network, slow]);
    if (first !== 'slow') return first;
    const exact = await match(key);
    return exact || (await network);
  } catch {
    return (await offlinePage(url)) || Response.error();
  }
}

/** The cached copy at once when there is one, refreshed in the background. */
async function staleWhileRevalidate(event) {
  const cached = await match(event.request);
  const network = fetch(event.request).then((res) => {
    const copy = res.clone();
    return store(event.request, copy, false).then(() => res);
  });
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

/**
 * A bulletin PDF from the network, ready to cache under its stable `/api/bulletins/<date>/pdf` path. The route
 * redirects to a signed storage URL that expires within the hour, so the response is rebuilt: same bytes, no
 * `redirected` flag (a redirected response cannot answer the iframe's navigation) and no signed URL anywhere in it.
 * Null when there is no PDF to save (404, 503, or not a PDF).
 */
async function fetchPdf(path) {
  const res = await fetch(path, { credentials: 'same-origin', redirect: 'follow' });
  const type = res.headers.get('Content-Type') || '';
  if (!res.ok || (type && !/pdf|octet-stream/i.test(type))) return null;
  const date = PDF_DATE.exec(new URL(path, self.location.origin).pathname)?.[1] ?? 'bulletin';
  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="bulletin-${date}.pdf"`,
      Date: new Date().toUTCString(),
    },
  });
}

/**
 * A saved bulletin PDF never changes, so a cached copy answers at once with no refresh (re-downloading 5 to 10 MB on
 * every view is not worth it). Otherwise it is downloaded, saved and shown; if that fails (a storage host without
 * CORS, say), the browser is left to follow the redirect itself, uncached.
 */
async function bulletinPdf(event, url) {
  const key = url.origin + url.pathname;
  const cached = await match(key);
  if (cached) return cached;
  try {
    const res = await fetchPdf(key);
    if (res) {
      event.waitUntil(storePdf(key, res.clone()).catch(() => {}));
      return res;
    }
  } catch {
    // Fall through to the plain request.
  }
  return fetch(event.request);
}

async function cacheFirst(event) {
  const cached = await match(event.request);
  if (cached) return cached;
  const res = await fetch(event.request);
  event.waitUntil(store(event.request, res.clone(), false).catch(() => {}));
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || never(url.pathname)) return;

  if (STATIC.test(url.pathname)) return event.respondWith(cacheFirst(event));
  if (PDF.test(url.pathname)) return event.respondWith(bulletinPdf(event, url));
  if (STALE_WHILE_REVALIDATE.some((re) => re.test(url.pathname))) return event.respondWith(staleWhileRevalidate(event));
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') return event.respondWith(page(event, url));
});

function isRecent(res) {
  const at = Date.parse(res.headers.get('Date') || '');
  return Number.isFinite(at) && Date.now() - at < PREFETCH_FRESH_MS;
}

/** Saves the static files a page needs to start (scripts, styles, fonts), found in its HTML. */
async function saveStaticFrom(html) {
  const paths = new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) || []);
  await saveStatic([...paths].map((p) => p.replace(/&amp;/g, '&')));
}

async function saveStatic(paths) {
  const cache = await caches.open(CACHE);
  await Promise.all(
    paths.map(async (p) => {
      if (await cache.match(p)) return;
      const res = await fetch(p).catch(() => null);
      if (cacheable(res, false)) await cache.put(p, res);
    }),
  );
}

async function prefetchOne(path) {
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin || never(url.pathname)) return;
  const isPage = !url.pathname.startsWith('/api/');
  const cached = await match(url.href);
  // A saved bulletin PDF never changes; anything else is refreshed unless it was saved moments ago.
  if (cached && (PDF.test(url.pathname) || isRecent(cached))) return;
  if (PDF.test(url.pathname)) {
    const pdf = await fetchPdf(url.origin + url.pathname);
    if (pdf) await storePdf(url.origin + url.pathname, pdf);
    return;
  }
  const res = await fetch(url.href, { credentials: 'same-origin' });
  if (!cacheable(res, isPage)) return;
  if (isPage) await saveStaticFrom(await res.clone().text());
  await store(url.href, res, isPage);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const READINGS_DATE = /^\/api\/readings\/([^/]+)$/;
// Bulletin entries are keyed by these paths only: a PDF is saved under its `/api/bulletins/<date>/pdf` path, never
// under the signed storage URL it redirects to (another origin, which this worker never caches).
const BULLETIN_DATE = /^\/(?:bulletin|api\/bulletins)\/([^/]+?)(?:\/pdf)?$/;
const PDF_DATE = /^\/api\/bulletins\/([^/]+)\/pdf$/;

/** The day a dated entry is for, or undefined for entries that are not about one day. */
function entryDate(url) {
  const reading = READINGS_DATE.exec(url.pathname);
  if (reading) return reading[1];
  if (['/', '/mass', '/sunday'].includes(url.pathname) && url.searchParams.has('date')) return url.searchParams.get('date');
  return undefined;
}

/** Static paths a saved page or stylesheet points at. Stylesheets name their fonts relative to themselves. */
function staticRefs(text, base) {
  const refs = (text.match(/\/_next\/static\/[^"'\\\s)<>?&]+/g) || []).slice();
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    try {
      refs.push(new URL(m[1], base).pathname);
    } catch {
      // Not a URL: nothing to keep.
    }
  }
  return refs.filter((p) => STATIC.test(p));
}

/**
 * Keeps the cache small, so storage pressure never makes the phone wipe the site's data (and with it the unsynced
 * personal outbox). Drops readings and Today/Mass/Sunday prep pages for days before today, any bare `/mass` or
 * `/sunday` copy (never read, see pageKey), every bulletin page or PDF but the newest one, and static files that neither a saved
 * page, its stylesheets, nor the running page (`assets`) uses, so old deploys' files do not pile up.
 */
async function prune(bulletinDate, assets) {
  const today = todayInChicago();
  const cache = await caches.open(CACHE);
  const statics = [];
  const pages = [];
  for (const req of await cache.keys()) {
    const url = new URL(req.url);
    if (STATIC.test(url.pathname)) {
      statics.push(req);
      continue;
    }
    const date = entryDate(url);
    let drop = date !== undefined && (!ISO_DATE.test(date) || date < today);
    if ((url.pathname === '/mass' || url.pathname === '/sunday') && !url.searchParams.has('date')) drop = true;
    const bulletin = bulletinDate ? BULLETIN_DATE.exec(url.pathname) : null;
    if (bulletin && bulletin[1] !== bulletinDate) drop = true;
    if (drop) await cache.delete(req);
    else if (!url.pathname.startsWith('/api/')) pages.push(req);
  }

  const used = new Set(assets.map((a) => new URL(a, self.location.origin).pathname));
  for (const req of pages) {
    const res = await cache.match(req);
    if (res) for (const p of staticRefs(await res.text(), req.url)) used.add(p);
  }
  // Stylesheets in use bring their fonts and images along.
  for (const req of statics) {
    const path = new URL(req.url).pathname;
    if (!used.has(path) || !path.endsWith('.css')) continue;
    const res = await cache.match(req);
    if (res) for (const p of staticRefs(await res.text(), req.url)) used.add(p);
  }
  for (const req of statics) {
    if (!used.has(new URL(req.url).pathname)) await cache.delete(req);
  }
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'prefetch') return;
  const urls = (Array.isArray(data.urls) ? data.urls : []).filter((u) => typeof u === 'string' && u.startsWith('/') && !u.startsWith('//'));
  const assets = (Array.isArray(data.assets) ? data.assets : []).filter((u) => typeof u === 'string' && STATIC.test(u));
  event.waitUntil(
    (async () => {
      await Promise.all([saveStatic(assets), ...urls.map((u) => prefetchOne(u).catch(() => {}))]);
      // Without a known newest bulletin (none saved, or the lookup failed), bulletin entries are left alone.
      const bulletinDate = typeof data.bulletinDate === 'string' && ISO_DATE.test(data.bulletinDate) ? data.bulletinDate : null;
      await prune(bulletinDate, assets).catch(() => {});
      if (event.source) event.source.postMessage({ type: 'prefetch-done' });
    })(),
  );
});
