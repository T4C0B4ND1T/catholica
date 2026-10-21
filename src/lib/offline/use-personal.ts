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
}

const EMPTY: PersonalState<never> = { rows: [], ready: false, signedIn: null };
const stores = new Map<Collection, Store>();
const cacheKey = (c: Collection) => `catholica.cache.${c}`;
const JSON_HEADERS = { 'content-type': 'application/json' };
// Statuses where retrying the same op can never succeed: drop it so it cannot block the queue.
const PERMANENT = [400, 409, 422];

async function send(op: OutboxOp): Promise<void> {
  const url = `/api/me/${op.collection}`;
  const res =
    op.method === 'upsert'
      ? await fetch(url, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(op.row) })
      : await fetch(`${url}?id=${encodeURIComponent(String(op.row.id))}`, { method: 'DELETE' });
  if (res.ok) return;
  if (PERMANENT.includes(res.status)) {
    console.warn('dropping rejected offline op', op.collection, res.status);
    return;
  }
  throw new Error(`sync failed: ${res.status}`);
}

const flushAll = () => outbox.flush(send);

let onlineHooked = false;
function hookOnline() {
  if (onlineHooked || typeof window === 'undefined') return;
  onlineHooked = true;
  window.addEventListener('online', () => void flushAll());
}

function getStore(c: Collection): Store {
  let s = stores.get(c);
  if (!s) {
    s = { state: EMPTY, listeners: new Set(), started: false };
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

async function load(c: Collection) {
  try {
    const cached = await get<{ id: string }[]>(cacheKey(c));
    if (cached && !getStore(c).state.ready) patch(c, { rows: cached });
  } catch {
    /* no cache */
  }
  await flushAll();
  try {
    const res = await fetch(`/api/me/${c}`, { cache: 'no-store' });
    if (res.status === 401) return patch(c, { rows: [], signedIn: false, ready: true });
    if (!res.ok) return patch(c, { ready: true });
    const { rows } = (await res.json()) as { rows: { id: string }[] };
    // Unsent local edits are newer than the server copy: keep them on screen.
    if ((await outbox.size()) === 0) patch(c, { rows });
    patch(c, { signedIn: true, ready: true });
    await persist(c);
  } catch {
    patch(c, { ready: true }); // offline: keep the cached rows
  }
}

function start(c: Collection) {
  const s = getStore(c);
  hookOnline();
  if (s.started) return;
  s.started = true;
  void load(c);
}

async function mutate(c: Collection, op: OutboxOp, rows: { id: string }[]) {
  patch(c, { rows });
  await persist(c);
  await outbox.enqueue(op);
  void flushAll();
}

/** Forget cached personal rows (call on sign out). Unsent ops stay queued for the next sign-in. */
export async function clearPersonalCache() {
  for (const c of stores.keys()) stores.delete(c);
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
