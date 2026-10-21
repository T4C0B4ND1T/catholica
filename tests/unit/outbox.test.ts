import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createOutbox, type OutboxOp } from '@/lib/offline/outbox';

let n = 0;
const fresh = () => `test-outbox-${n++}`;
const op = (id: string): OutboxOp => ({ collection: 'notes', method: 'upsert', row: { id } });

describe('outbox', () => {
  it('flushes three ops in order', async () => {
    const box = createOutbox(fresh());
    await box.enqueue(op('1'));
    await box.enqueue(op('2'));
    await box.enqueue(op('3'));
    const seen: string[] = [];
    const sent = await box.flush(async (o) => void seen.push(String(o.row.id)));
    expect(sent).toBe(3);
    expect(seen).toEqual(['1', '2', '3']);
    expect(await box.size()).toBe(0);
  });

  it('stops at the first failure and keeps that op and the rest', async () => {
    const box = createOutbox(fresh());
    for (const id of ['1', '2', '3']) await box.enqueue(op(id));
    const sent = await box.flush(async (o) => {
      if (o.row.id === '2') throw new Error('offline');
    });
    expect(sent).toBe(1);
    expect(await box.size()).toBe(2);
    const seen: string[] = [];
    expect(await box.flush(async (o) => void seen.push(String(o.row.id)))).toBe(2);
    expect(seen).toEqual(['2', '3']);
  });

  it('persists across a new outbox instance', async () => {
    const key = fresh();
    await createOutbox(key).enqueue(op('a'));
    await createOutbox(key).enqueue(op('b'));
    const seen: string[] = [];
    const sent = await createOutbox(key).flush(async (o) => void seen.push(String(o.row.id)));
    expect(sent).toBe(2);
    expect(seen).toEqual(['a', 'b']);
  });
});
