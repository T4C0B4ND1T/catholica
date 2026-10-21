import { get, update } from 'idb-keyval';

export type Collection = 'notes' | 'bookmarks' | 'intentions' | 'routines' | 'routine_ticks';

export interface OutboxOp {
  collection: Collection;
  method: 'upsert' | 'delete';
  row: Record<string, unknown>;
}

/** Durable queue of pending writes, kept in IndexedDB so it survives reloads while offline. */
export function createOutbox(key = 'catholica.outbox') {
  // Flushes run one at a time so an op is never sent twice by overlapping flushes.
  let chain: Promise<unknown> = Promise.resolve();

  async function drain(send: (op: OutboxOp) => Promise<void>): Promise<number> {
    let sent = 0;
    for (;;) {
      const queue = (await get<OutboxOp[]>(key)) ?? [];
      if (queue.length === 0) return sent;
      try {
        await send(queue[0]);
      } catch {
        return sent;
      }
      // Only flush removes entries, and always from the head.
      await update<OutboxOp[]>(key, (q) => (q ?? []).slice(1));
      sent++;
    }
  }

  return {
    async enqueue(op: OutboxOp): Promise<void> {
      await update<OutboxOp[]>(key, (q) => [...(q ?? []), op]);
    },
    async size(): Promise<number> {
      return ((await get<OutboxOp[]>(key)) ?? []).length;
    },
    /** Sends queued ops in order. Stops at the first failure, keeps the rest, and returns how many were sent. */
    flush(send: (op: OutboxOp) => Promise<void>): Promise<number> {
      const run = () => drain(send);
      const result = chain.then(run, run);
      chain = result.catch(() => undefined);
      return result;
    },
  };
}

export const outbox = createOutbox();
