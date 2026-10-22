import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
const seeded = Boolean(url && anonKey && serviceKey);

// Must match ALLOWED_EMAIL in playwright.config.ts.
const EMAIL = 'me-e2e@catholica.test';
const PASSWORD = 'me-e2e-password-123';
const OTHER_EMAIL = 'me-e2e-other@catholica.test';

test.describe('Me tab, signed out', () => {
  test('settings work and synced sections are disabled', async ({ page }) => {
    await page.goto('/me');
    await expect(page.getByText('Sign in to sync your notes and prayers')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
    await expect(page.getByRole('group', { name: /Synced sections/ })).toHaveAttribute('disabled', '');

    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');

    await page.getByLabel('Text size').fill('130');
    await expect(page.locator('html')).toHaveAttribute('data-text-scale', '1.3');
    await page.reload();
    await expect(page.getByLabel('Text size')).toHaveValue('130');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByLabel('Reading speed').fill('1.2');
    await page.reload();
    await expect(page.getByLabel('Reading speed')).toHaveValue('1.2');
  });

  test('no horizontal scroll at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/me');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('Me tab, signed in', () => {
  test.describe.configure({ mode: 'serial' });

  let admin: SupabaseClient;
  let userId: string;
  let otherId: string;
  let cookies: { name: string; value: string }[] = [];

  async function userRows(table: string) {
    const { data, error } = await admin.from(table).select('*').eq('user_id', userId);
    if (error) throw error;
    return data;
  }

  test.beforeAll(async () => {
    if (!seeded) return;
    const opts = { auth: { persistSession: false, autoRefreshToken: false } };
    admin = createClient(url!, serviceKey!, opts);
    async function ensureUser(email: string): Promise<string> {
      const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (!created.error) return created.data.user.id;
      const list = await admin.auth.admin.listUsers({ perPage: 200 });
      const found = list.data.users.find((u) => u.email === email);
      if (!found) throw created.error;
      return found.id;
    }
    userId = await ensureUser(EMAIL);
    otherId = await ensureUser(OTHER_EMAIL);

    // Sign in through Supabase and capture the @supabase/ssr session cookies.
    const jar = new Map<string, string>();
    const ssr = createServerClient(url!, anonKey!, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (list) => list.forEach((c) => jar.set(c.name, c.value)),
      },
    });
    const { error } = await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    if (error) throw error;
    cookies = [...jar].map(([name, value]) => ({ name, value }));
    expect(cookies.length).toBeGreaterThan(0);
  });

  test.beforeEach(async ({ context }) => {
    test.skip(!seeded, 'needs SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY and SUPABASE_TEST_SERVICE_KEY');
    for (const t of ['routine_ticks', 'intentions', 'notes', 'bookmarks']) {
      await admin.from(t).delete().eq('user_id', userId);
    }
    await context.addCookies(cookies.map((c) => ({ ...c, url: 'http://localhost:3000' })));
  });

  test.afterAll(async () => {
    if (seeded && userId) await admin.auth.admin.deleteUser(userId);
    if (seeded && otherId) await admin.auth.admin.deleteUser(otherId);
  });

  test('default routines exist and a ticked Angelus survives reload', async ({ page }) => {
    await page.goto('/me');
    for (const name of ['Morning Offering', 'Angelus', 'Rosary', 'Examen']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    const angelus = page.getByRole('button', { name: 'Angelus', exact: true });
    await angelus.click();
    await expect(angelus).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await userRows('routine_ticks')).length).toBe(1);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Angelus', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect((await userRows('routines')).length).toBe(4);
  });

  test('add, rename and delete a daily prayer; a library prayer links to its text', async ({ page }) => {
    await page.goto('/me');
    await expect(page.getByRole('link', { name: 'Read the Angelus' })).toHaveAttribute('href', '/prayers/angelus');
    const prayers = page.getByRole('region', { name: 'Daily prayers' });
    try {
      await prayers.getByRole('button', { name: 'Edit', exact: true }).click();
      await prayers.getByLabel('New prayer').fill('Memorare');
      await prayers.getByRole('button', { name: 'Add', exact: true }).click();
      await expect.poll(async () => (await userRows('routines')).map((r) => r.name)).toContain('Memorare');
      const name = page.getByLabel('Name of Memorare');
      await name.fill('Synthetic Routine');
      await name.press('Enter');
      await expect.poll(async () => (await userRows('routines')).map((r) => r.name)).toContain('Synthetic Routine');
      await page.getByRole('button', { name: 'Delete Synthetic Routine' }).click();
      await expect.poll(async () => (await userRows('routines')).length).toBe(4);
      await prayers.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByRole('button', { name: 'Angelus', exact: true })).toBeVisible();
    } finally {
      await admin.from('routines').delete().eq('user_id', userId).in('name', ['Memorare', 'Synthetic Routine']);
    }
  });

  test('add an intention and mark it answered', async ({ page }) => {
    await page.goto('/me');
    await page.getByLabel('New intention').fill('For my family');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const toggle = page.getByRole('button', { name: 'Answered: For my family' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await userRows('intentions'))[0]?.answered_at ?? null).not.toBeNull();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Answered: For my family' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('Dark theme sets data-theme on html', async ({ page }) => {
    await page.goto('/me');
    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('a note written offline reaches the database once back online', async ({ page, context }) => {
    await page.goto('/me');
    await expect(page.getByRole('button', { name: 'Angelus', exact: true })).toBeVisible();
    await context.setOffline(true);
    await page.getByLabel(/^\w{3}, /).fill('Offline reflection');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(page.getByRole('button', { name: 'Save note' })).toBeDisabled();
    expect(await userRows('notes')).toHaveLength(0);
    await context.setOffline(false);
    await expect.poll(async () => (await userRows('notes')).map((n) => n.body), { timeout: 15_000 }).toEqual([
      'Offline reflection',
    ]);
  });

  test('bookmark a Mass reading and open it from Me', async ({ page }) => {
    const date = '2099-01-04';
    await admin.from('readings').upsert({
      date,
      feast: 'Synthetic Test Sunday',
      season: 'ordinary',
      color: 'green',
      sections: [{ kind: 'gospel', title: 'Gospel', citation: 'Test 1:1', text: 'SYNTHETIC (not scripture)' }],
      source_url: 'https://example.invalid/synthetic',
    });
    try {
      await page.goto(`/mass?date=${date}`);
      const mark = page.locator('#holy-gospel').getByRole('button', { name: 'Bookmark Gospel' });
      await expect(mark).toBeEnabled();
      await mark.click();
      await expect(mark).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(async () => (await userRows('bookmarks')).length).toBe(1);
      await page.goto('/me');
      const link = page.getByRole('link', { name: /Gospel/ });
      await expect(link).toHaveAttribute('href', `/?date=${date}`);
    } finally {
      await admin.from('readings').delete().eq('date', date);
    }
  });

  test('same-day note written elsewhere is overwritten, not rejected', async ({ context }) => {
    const date = '2099-02-02';
    const post = (id: string, body: string) =>
      context.request.post('/api/me/notes', { data: { id, date, body } });
    expect((await post(crypto.randomUUID(), 'first device')).status()).toBe(200);
    expect((await post(crypto.randomUUID(), 'second device')).status()).toBe(200);
    const rows = (await userRows('notes')).filter((n) => n.date === date);
    expect(rows.map((n) => n.body)).toEqual(['second device']);
  });

  test.describe('api security', () => {
    const rid = () => crypto.randomUUID();

    test('unauthenticated requests get 401', async ({ playwright }) => {
      const anon = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
      expect((await anon.get('/api/me/notes')).status()).toBe(401);
      expect((await anon.post('/api/me/notes', { data: { id: rid(), date: '2099-01-01', body: 'x' } })).status()).toBe(401);
      expect((await anon.delete(`/api/me/notes?id=${rid()}`)).status()).toBe(401);
      await anon.dispose();
    });

    test('unknown collection is 404', async ({ context }) => {
      expect((await context.request.get('/api/me/profiles')).status()).toBe(404);
    });

    test('a forged user_id is stored under the caller', async ({ context }) => {
      const id = rid();
      const res = await context.request.post('/api/me/intentions', {
        data: { id, text: 'forged', user_id: otherId },
      });
      expect(res.status()).toBe(200);
      const { data } = await admin.from('intentions').select('user_id').eq('id', id).single();
      expect(data?.user_id).toBe(userId);
    });

    test("another user's row cannot be overwritten or deleted", async ({ context }) => {
      const id = rid();
      const { error } = await admin
        .from('intentions')
        .insert({ id, user_id: otherId, text: 'private to other' });
      expect(error).toBeNull();
      const post = await context.request.post('/api/me/intentions', { data: { id, text: 'hijacked' } });
      expect(post.ok()).toBe(false);
      await context.request.delete(`/api/me/intentions?id=${id}`);
      const { data } = await admin.from('intentions').select('user_id, text').eq('id', id).single();
      expect(data).toEqual({ user_id: otherId, text: 'private to other' });
      await admin.from('intentions').delete().eq('id', id);
    });

    test("a tick for another user's routine is rejected", async ({ context }) => {
      const routineId = rid();
      await admin.from('routines').insert({ id: routineId, user_id: otherId, name: 'Other', sort_order: 0 });
      const res = await context.request.post('/api/me/routine_ticks', {
        data: { id: rid(), routine_id: routineId, date: '2099-01-01' },
      });
      expect(res.ok()).toBe(false);
      const { data } = await admin.from('routine_ticks').select('id').eq('routine_id', routineId);
      expect(data).toEqual([]);
    });
  });
});
