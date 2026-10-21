import type { Collection } from '@/lib/offline/outbox';
import { addDays } from '@/lib/dates';

export const COLLECTIONS: readonly Collection[] = ['notes', 'bookmarks', 'intentions', 'routines', 'routine_ticks'];

export function isCollection(value: string): value is Collection {
  return (COLLECTIONS as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECTIONS = ['reading1', 'psalm', 'reading2', 'sequence', 'alleluia', 'gospel', 'other'];

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  try {
    return addDays(v, 0) === v;
  } catch {
    return false;
  }
}

function isText(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.trim() !== '' && v.length <= max;
}

/**
 * Picks the writable columns for a collection from an untrusted body.
 * Returns null when invalid. user_id and updated_at are never taken from the client.
 */
export function pickRow(collection: Collection, body: unknown): Record<string, unknown> | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!isUuid(b.id)) return null;
  const id = b.id;
  switch (collection) {
    case 'notes':
      return isDate(b.date) && typeof b.body === 'string' && b.body.length <= 20_000
        ? { id, date: b.date, body: b.body }
        : null;
    case 'bookmarks':
      return isDate(b.date) && typeof b.section === 'string' && SECTIONS.includes(b.section)
        ? { id, date: b.date, section: b.section }
        : null;
    case 'intentions': {
      const answered = b.answered_at ?? null;
      const okAnswered =
        answered === null || (typeof answered === 'string' && !Number.isNaN(Date.parse(answered)));
      return isText(b.text, 2_000) && okAnswered ? { id, text: b.text, answered_at: answered } : null;
    }
    case 'routines':
      return isText(b.name, 100) && Number.isInteger(b.sort_order)
        ? { id, name: b.name, sort_order: b.sort_order }
        : null;
    case 'routine_ticks':
      return isUuid(b.routine_id) && isDate(b.date) ? { id, routine_id: b.routine_id, date: b.date } : null;
  }
}
