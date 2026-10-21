import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/require-user';
import { createServerClient } from '@/lib/db/server';
import { isCollection, isUuid, pickRow } from '@/lib/me/validate';
import type { Collection } from '@/lib/offline/outbox';

const DEFAULT_ROUTINES = ['Morning Offering', 'Angelus', 'Rosary', 'Examen'];

const COLUMNS: Record<Collection, string> = {
  notes: 'id, date, body, updated_at',
  bookmarks: 'id, date, section, created_at',
  intentions: 'id, text, answered_at, created_at',
  routines: 'id, name, sort_order',
  routine_ticks: 'id, routine_id, date',
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

async function handle(ctx: Ctx, run: (c: Collection, userId: string, db: SupabaseClient) => Promise<Response>) {
  try {
    const user = await requireUser();
    const { collection } = await ctx.params;
    if (!isCollection(collection)) return json({ error: 'not found' }, 404);
    return await run(collection, user.id, await createServerClient());
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('me api failed', e instanceof Error ? e.message : e);
    return json({ error: 'server error' }, 500);
  }
}

export function GET(_req: Request, ctx: Ctx) {
  return handle(ctx, async (collection, userId, db) => {
    let { data, error } = await list(db, collection);
    if (error) return json({ error: 'server error' }, 500);
    if (collection === 'routines' && (data ?? []).length === 0) {
      const defaults = DEFAULT_ROUTINES.map((name, i) => ({
        id: defaultRoutineId(userId, name),
        user_id: userId,
        name,
        sort_order: i,
      }));
      const seeded = await db.from('routines').upsert(defaults, { onConflict: 'id', ignoreDuplicates: true });
      if (seeded.error) return json({ error: 'server error' }, 500);
      ({ data, error } = await list(db, collection));
      if (error) return json({ error: 'server error' }, 500);
    }
    return json({ rows: data ?? [] });
  });
}

export function POST(req: Request, ctx: Ctx) {
  return handle(ctx, async (collection, userId, db) => {
    const row = pickRow(collection, await req.json().catch(() => null));
    if (!row) return json({ error: 'invalid row' }, 400);
    const { error } = await db
      .from(collection)
      .upsert({ ...row, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'id' });
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
  return handle(ctx, async (collection, _userId, db) => {
    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) return json({ error: 'invalid id' }, 400);
    const { error } = await db.from(collection).delete().eq('id', id);
    if (error) return json({ error: 'server error' }, 500);
    return json({ ok: true });
  });
}
