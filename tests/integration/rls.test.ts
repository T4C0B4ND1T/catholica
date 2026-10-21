import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const stamp = Date.now();
const password = 'test-password-123';

describe.skipIf(!enabled)('row-level security', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let a: SupabaseClient;
  let b: SupabaseClient;
  const ids: string[] = [];

  async function signedIn(email: string): Promise<SupabaseClient> {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    ids.push(data.user.id);
    const client = createClient(url!, anonKey!, opts);
    const res = await client.auth.signInWithPassword({ email, password });
    if (res.error) throw res.error;
    return client;
  }

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, opts);
    anon = createClient(url!, anonKey!, opts);
    a = await signedIn(`a-${stamp}@test.local`);
    b = await signedIn(`b-${stamp}@test.local`);
    await admin.from('readings').upsert({
      date: '2099-01-01', season: 'ordinary', color: 'green', sections: [],
    });
  });

  afterAll(async () => {
    await admin.from('readings').delete().eq('date', '2099-01-01');
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  });

  it("hides one user's notes from another", async () => {
    const ins = await a.from('notes').insert({ date: '2099-01-01', body: 'private' });
    expect(ins.error).toBeNull();
    const own = await a.from('notes').select('*');
    expect(own.data).toHaveLength(1);
    const other = await b.from('notes').select('*');
    expect(other.error).toBeNull();
    expect(other.data).toHaveLength(0);
  });

  it('rejects writing a row owned by someone else', async () => {
    const { data } = await a.auth.getUser();
    const res = await b
      .from('notes')
      .insert({ user_id: data.user!.id, date: '2099-01-02', body: 'spoof' });
    expect(res.error).not.toBeNull();
  });

  it('gives anonymous users no access to personal tables', async () => {
    const res = await anon.from('notes').select('*');
    expect(res.data ?? []).toHaveLength(0);
    const ins = await anon.from('notes').insert({ date: '2099-01-03', body: 'x' });
    expect(ins.error).not.toBeNull();
  });

  it('lets anonymous users read shared readings', async () => {
    const res = await anon.from('readings').select('date').eq('date', '2099-01-01');
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1);
  });

  it('rejects anonymous and signed-in writes to shared tables', async () => {
    const row = { date: '2099-02-02', season: 'ordinary', color: 'green', sections: [] };
    expect((await anon.from('readings').insert(row)).error).not.toBeNull();
    expect((await a.from('readings').insert(row)).error).not.toBeNull();
    const del = await a.from('readings').delete().eq('date', '2099-01-01');
    expect(del.error).toBeNull();
    const still = await admin.from('readings').select('date').eq('date', '2099-01-01');
    expect(still.data).toHaveLength(1);
  });

  it('isolates bookmarks and intentions per user', async () => {
    expect((await a.from('bookmarks').insert({ date: '2099-01-01', section: 'gospel' })).error).toBeNull();
    expect((await a.from('intentions').insert({ text: 'for peace' })).error).toBeNull();
    for (const table of ['bookmarks', 'intentions']) {
      expect((await a.from(table).select('*')).data).toHaveLength(1);
      const other = await b.from(table).select('*');
      expect(other.error).toBeNull();
      expect(other.data).toHaveLength(0);
    }
    const { data } = await a.auth.getUser();
    const spoof = await b.from('intentions').insert({ user_id: data.user!.id, text: 'spoof' });
    expect(spoof.error).not.toBeNull();
  });

  it("rejects a tick on someone else's routine", async () => {
    const r = await a.from('routines').insert({ name: 'Rosary' }).select().single();
    expect(r.error).toBeNull();
    const own = await a.from('routine_ticks').insert({ routine_id: r.data!.id, date: '2099-01-01' });
    expect(own.error).toBeNull();
    const bad = await b.from('routine_ticks').insert({ routine_id: r.data!.id, date: '2099-01-01' });
    expect(bad.error).not.toBeNull();
    expect((await b.from('routine_ticks').select('*')).data).toHaveLength(0);
  });

  it('keeps job_runs service-role only', async () => {
    await admin.from('job_runs').insert({ job: 'test', status: 'ok', message: 'secret upstream error' });
    expect((await anon.from('job_runs').select('*')).data ?? []).toHaveLength(0);
    expect((await a.from('job_runs').select('*')).data ?? []).toHaveLength(0);
    await admin.from('job_runs').delete().eq('job', 'test');
  });
});
