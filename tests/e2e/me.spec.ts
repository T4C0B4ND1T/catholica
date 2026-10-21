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
    const created = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
    if (created.error) {
      const list = await admin.auth.admin.listUsers({ perPage: 200 });
      const found = list.data.users.find((u) => u.email === EMAIL);
      if (!found) throw created.error;
      userId = found.id;
    } else {
      userId = created.data.user.id;
    }

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
});
