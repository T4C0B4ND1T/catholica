import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const state = { rows: [] as { id: string; name: string; sort_order: number }[], metadata: {} as Record<string, unknown> };
  const query = () => {
    const q = {
      select: () => q,
      order: () => q,
      then: (res: (v: { data: unknown; error: null }) => unknown) => res({ data: [...state.rows], error: null }),
    };
    return q;
  };
  const db = {
    from: () => ({
      ...query(),
      upsert: vi.fn(async (rows: { id: string; name: string; sort_order: number }[]) => {
        state.rows.push(...rows);
        return { error: null };
      }),
    }),
    auth: {
      updateUser: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state.metadata, data);
        return { error: null };
      }),
    },
  };
  return {
    state,
    db,
    requireUser: vi.fn(async () => ({ id: 'u1', email: 'me@x.test', metadata: { ...state.metadata } })),
  };
});

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/require-user', () => ({ requireUser: h.requireUser }));
vi.mock('@/lib/db/server', () => ({ createServerClient: async () => h.db }));

import { GET } from '@/app/api/me/[collection]/route';

const get = async () => (await GET(new Request('http://x/api/me/routines'), { params: Promise.resolve({ collection: 'routines' }) })).json();

describe('routines defaults', () => {
  beforeEach(() => {
    h.state.rows = [];
    h.state.metadata = {};
    h.db.auth.updateUser.mockClear();
  });

  it('seeds the four defaults on the first visit and remembers it', async () => {
    const body = await get();
    expect(body.rows.map((r: { name: string }) => r.name)).toEqual(['Morning Offering', 'Angelus', 'Rosary', 'Examen']);
    expect(h.state.metadata.routines_seeded).toBe(true);
  });

  it('does not bring them back after every routine is deleted', async () => {
    await get();
    h.state.rows = [];
    const body = await get();
    expect(body.rows).toEqual([]);
  });

  it('marks a user who already has routines without adding any', async () => {
    h.state.rows = [{ id: 'r1', name: 'Mine', sort_order: 0 }];
    const body = await get();
    expect(body.rows).toHaveLength(1);
    expect(h.state.metadata.routines_seeded).toBe(true);
  });
});
