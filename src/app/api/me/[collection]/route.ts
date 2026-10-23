import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/require-user';
import { createServerClient } from '@/lib/db/server';
import { isCollection, isUuid, pickRow } from '@/lib/me/validate';
import type { Collection } from '@/lib/offline/outbox';

const DEFAULT_ROUTINES = ['Morning Offering', 'Angelus', 'Rosary', 'Examen'];
/** Set on the user once they have routines, so deleting every routine later doesn't bring the defaults back. */
const ROUTINES_SEEDED = 'routines_seeded';

const COLUMNS: Record<Collection, string> = {
  notes: 'id, date, body, updated_at',
  bookmarks: 'id, date, section, created_at',
  intentions: 'id, text, answered_at, created_at',
  routines: 'id, name, sort_order',
  routine_ticks: 'id, routine_id, date',
};

// Same-day writes from another device share a natural key: last edit wins instead of conflicting.
const CONFLICT_TARGET: Partial<Record<Collection, string>> = {
  notes: 'user_id,date',
  bookmarks: 'user_id,date,section',
  routine_ticks: 'routine_id,date',
};

type Ctx = { params: Promise<{ collection: string }> };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

/** A stable UUID per (user, routine name), so concurrent first requests create each default once. */
function defaultRoutineId(userId: string, name: string): string {
  const h = createHash('sha1').update(`${userId}:routine:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

async function list(db: SupabaseClient, collection: Collection) {
  let q = db.from(collection).select(COLUMNS[collection]);
  if (collection === 'routines') q = q.order('sort_order').order('id');
  else if (collection === 'routine_ticks') q = q.order('date', { ascending: false }).limit(1000);
  else if (collection === 'notes') q = q.order('date', { ascending: false }).limit(1000);
  else q = q.order('created_at', { ascending: false }).limit(1000);
  return q;
}

type User = Awaited<ReturnType<typeof requireUser>>;

async function markRoutinesSeeded(db: SupabaseClient): Promise<void> {
  const { error } = await db.auth.updateUser({ data: { [ROUTINES_SEEDED]: true } });
  if (error) console.error('marking routines seeded failed', error.message);
}

async function handle(ctx: Ctx, run: (c: Collection, user: User, db: SupabaseClient) => Promise<Response>) {
  try {
    const user = await requireUser();
    const { collection } = await ctx.params;
    if (!isCollection(collection)) return json({ error: 'not found' }, 404);
    return await run(collection, user, await createServerClient());
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('me api failed', e instanceof Error ? e.message : e);
    return json({ error: 'server error' }, 500);
  }
}

export function GET(_req: Request, ctx: Ctx) {
  return handle(ctx, async (collection, user, db) => {
    const userId = user.id;
    let { data, error } = await list(db, collection);
    if (error) return json({ error: 'server error' }, 500);
    const seeded = user.metadata[ROUTINES_SEEDED] === true;
    if (collection === 'routines' && !seeded) {
      // First visit: give the four defaults. Users from before the flag already have routines and only get the flag.
      // The flag is best-effort: if saving it fails, the next visit tries again.
      if ((data ?? []).length > 0) {
        await markRoutinesSeeded(db);
        return json({ rows: data ?? [] });
      }
      const defaults = DEFAULT_ROUTINES.map((name, i) => ({
        id: defaultRoutineId(userId, name),
        user_id: userId,
        name,
        sort_order: i,
      }));
      const saved = await db.from('routines').upsert(defaults, { onConflict: 'id', ignoreDuplicates: true });
      if (saved.error) return json({ error: 'server error' }, 500);
      await markRoutinesSeeded(db);
      ({ data, error } = await list(db, collection));
      if (error) return json({ error: 'server error' }, 500);
    }
    return json({ rows: data ?? [] });
  });
}

export function POST(req: Request, ctx: Ctx) {
  return handle(ctx, async (collection, { id: userId }, db) => {
    const row = pickRow(collection, await req.json().catch(() => null));
    if (!row) return json({ error: 'invalid row' }, 400);
    const { error } = await db
      .from(collection)
      .upsert({ ...row, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: CONFLICT_TARGET[collection] ?? 'id' });
    if (error) {
      if (error.code === '23505') return json({ error: 'conflict' }, 409);
      // Constraint or RLS rejection: retrying cannot help. Anything else may be transient.
      if (error.code?.startsWith('23') || error.code === '42501') return json({ error: 'rejected' }, 400);
      return json({ error: 'server error' }, 500);
    }
    return json({ row });
  });
}

export function DELETE(req: Request, ctx: Ctx) {
  return handle(ctx, async (collection, _user, db) => {
    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) return json({ error: 'invalid id' }, 400);
    const { error } = await db.from(collection).delete().eq('id', id);
    if (error) return json({ error: 'server error' }, 500);
    return json({ ok: true });
  });
}
