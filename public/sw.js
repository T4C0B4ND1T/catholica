/* Catholica service worker: keeps the coming week readable with no signal. */
/* global self, caches, fetch, URL */

// Bump to drop every cached response on the next activation.
const CACHE = 'catholica-v1';
const NAV_TIMEOUT_MS = 3000;
// A prefetch skips a URL cached this recently (the server's Date header), so repeat app opens stay light.
const PREFETCH_FRESH_MS = 15 * 60 * 1000;

const NEVER = [/^\/api\/me(\/|$)/, /^\/api\/cron(\/|$)/, /^\/auth(\/|$)/];
const STALE_WHILE_REVALIDATE = [/^\/api\/readings\/[^/]+$/, /^\/api\/bulletins\/[^/]+\/pdf$/];
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

/** Offline fallbacks for a page: the exact URL, then for a bare `/mass` today's Mass, then the same page for
 * another date, then the `/` shell (the Today page re-renders itself from cached readings). */
async function cachedPage(url) {
  const candidates = [url.href];
  if (url.pathname === '/mass' && !url.searchParams.has('date')) candidates.push(`/mass?date=${todayInChicago()}`);
  candidates.push(url.pathname);
  for (const key of candidates) {
    const hit = await match(key);
    if (hit) return hit;
  }
  return (await match(url.pathname, { ignoreSearch: true })) || (await match('/'));
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

/** Network first; after 3 seconds or on failure, the cached page. The network answer still refreshes the cache. */
async function page(event, url) {
  const network = fetch(event.request);
  event.waitUntil(network.then((res) => store(event.request, res.clone(), true)).catch(() => {}));
  try {
    return await Promise.race([network, timeout(NAV_TIMEOUT_MS)]);
  } catch {
    const cached = await cachedPage(url);
    return cached || network;
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
  const res = await fetch(url.href, { credentials: 'same-origin' });
  if (!cacheable(res, isPage)) return;
  if (isPage) await saveStaticFrom(await res.clone().text());
  await store(url.href, res, isPage);
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'prefetch') return;
  const urls = (Array.isArray(data.urls) ? data.urls : []).filter((u) => typeof u === 'string' && u.startsWith('/') && !u.startsWith('//'));
  const assets = (Array.isArray(data.assets) ? data.assets : []).filter((u) => typeof u === 'string' && STATIC.test(u));
  event.waitUntil(
    (async () => {
      await Promise.all([saveStatic(assets), ...urls.map((u) => prefetchOne(u).catch(() => {}))]);
      if (event.source) event.source.postMessage({ type: 'prefetch-done' });
    })(),
  );
});
