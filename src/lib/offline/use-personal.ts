'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { del, get, set } from 'idb-keyval';
import { outbox, type Collection, type OutboxOp } from './outbox';

export interface PersonalState<T> {
  rows: T[];
  /** True once the first server answer (or failure) has been handled. */
  ready: boolean;
  /** null until the server has answered; false when the API returned 401. */
  signedIn: boolean | null;
}

interface Store {
  state: PersonalState<{ id: string }>;
  listeners: Set<() => void>;
  started: boolean;
  /** Bumped by every local mutation; a server/cache response older than that is stale. */
  version: number;
  /** Mutations between their optimistic patch and being queued. */
  inflight: number;
}

const EMPTY: PersonalState<never> = { rows: [], ready: false, signedIn: null };
const stores = new Map<Collection, Store>();
const cacheKey = (c: Collection) => `catholica.cache.${c}`;
const JSON_HEADERS = { 'content-type': 'application/json' };
// Rejections that retrying the same op will not fix; dropped after MAX_ATTEMPTS.
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, number>();
// Set on a 401: stop flushing until a fetch shows we are signed in again.
let authBlocked = false;
// Collections whose server copy changed (or an op was dropped) during a flush: refetch them after.
const touched = new Set<Collection>();

async function send(op: OutboxOp): Promise<void> {
  const url = `/api/me/${op.collection}`;
  const res =
    op.method === 'upsert'
      ? await fetch(url, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(op.row) })
      : await fetch(`${url}?id=${encodeURIComponent(String(op.row.id))}`, { method: 'DELETE' });
  if (res.ok) {
    touched.add(op.collection);
    return;
  }
  if (res.status === 401) {
    authBlocked = true;
    throw new Error('not signed in');
  }
  if (res.status >= 400 && res.status < 500) {
    const key = JSON.stringify(op);
    const n = (attempts.get(key) ?? 0) + 1;
    if (n >= MAX_ATTEMPTS) {
      attempts.delete(key);
      console.warn('dropping rejected offline op', op.collection, res.status);
      touched.add(op.collection); // local state must match the server again
      return;
    }
    attempts.set(key, n);
  }
  throw new Error(`sync failed: ${res.status}`);
}

async function flushAll(): Promise<number> {
  if (authBlocked) return 0;
  const sent = await outbox.flush(send);
  for (const c of [...touched]) {
    touched.delete(c);
    if (stores.get(c)?.started) void pull(c);
  }
  return sent;
}

let onlineHooked = false;
function hookOnline() {
  if (onlineHooked || typeof window === 'undefined') return;
  onlineHooked = true;
  window.addEventListener('online', () => void flushAll());
}

function getStore(c: Collection): Store {
  let s = stores.get(c);
  if (!s) {
    s = { state: EMPTY, listeners: new Set(), started: false, version: 0, inflight: 0 };
    stores.set(c, s);
  }
  return s;
}

function patch(c: Collection, next: Partial<PersonalState<{ id: string }>>) {
  const s = getStore(c);
  s.state = { ...s.state, ...next };
  s.listeners.forEach((l) => l());
}

async function persist(c: Collection) {
  try {
    await set(cacheKey(c), getStore(c).state.rows);
  } catch {
    /* IndexedDB unavailable: the server copy still syncs */
  }
}

/** Fetch the server rows. Skipped if a local mutation happened since the request began. */
async function pull(c: Collection) {
  const s = getStore(c);
  const v = s.version;
  try {
    const res = await fetch(`/api/me/${c}`, { cache: 'no-store' });
    if (res.status === 401) return patch(c, { rows: [], signedIn: false, ready: true });
    if (!res.ok) return patch(c, { ready: true });
    const { rows } = (await res.json()) as { rows: { id: string }[] };
    authBlocked = false;
    // Unsent or newer local edits win on screen; the flush that follows them refetches.
    if (s.version === v && s.inflight === 0 && (await outbox.size()) === 0 && s.version === v) {
      patch(c, { rows });
      await persist(c);
    }
    patch(c, { signedIn: true, ready: true });
  } catch {
    patch(c, { ready: true }); // offline: keep the cached rows
  }
}

async function load(c: Collection) {
  const s = getStore(c);
  const v = s.version;
  try {
    const cached = await get<{ id: string }[]>(cacheKey(c));
    if (cached && !s.state.ready && s.version === v) patch(c, { rows: cached });
  } catch {
    /* no cache */
  }
  await flushAll();
  await pull(c);
}

function start(c: Collection) {
  const s = getStore(c);
  hookOnline();
  if (s.started) return;
  s.started = true;
  void load(c);
}

async function mutate(c: Collection, op: OutboxOp, rows: { id: string }[]) {
  const s = getStore(c);
  s.version++;
  s.inflight++;
  patch(c, { rows });
  try {
    await outbox.enqueue(op);
  } finally {
    s.inflight--;
  }
  await persist(c);
  void flushAll();
}

/** Forget cached personal rows and the unsent queue (call on sign out). */
export async function clearPersonalCache() {
  for (const c of stores.keys()) stores.delete(c);
  touched.clear();
  attempts.clear();
  await outbox.clear().catch(() => undefined);
  await Promise.all(
    (['notes', 'bookmarks', 'intentions', 'routines', 'routine_ticks'] as const).map((c) =>
      del(cacheKey(c)).catch(() => undefined),
    ),
  );
}

export function usePersonal<T extends { id: string }>(collection: Collection) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const s = getStore(collection);
      s.listeners.add(cb);
      return () => void s.listeners.delete(cb);
    },
    [collection],
  );
  const state = useSyncExternalStore(
    subscribe,
    () => getStore(collection).state as PersonalState<T>,
    () => EMPTY as PersonalState<T>,
  );
  useEffect(() => start(collection), [collection]);

  const upsert = useCallback(
    (row: T) => {
      const rows = getStore(collection).state.rows;
      const next = rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row];
      return mutate(collection, { collection, method: 'upsert', row }, next);
    },
    [collection],
  );
  const remove = useCallback(
    (id: string) => {
      const rows = getStore(collection).state.rows.filter((r) => r.id !== id);
      return mutate(collection, { collection, method: 'delete', row: { id } }, rows);
    },
    [collection],
  );

  return { rows: state.rows, ready: state.ready, signedIn: state.signedIn, upsert, remove };
}
