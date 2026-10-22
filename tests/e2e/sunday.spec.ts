import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
const seeded = Boolean(url && serviceKey);

// 2099-03-01 is a Sunday no other spec uses. Clearly synthetic rows, removed afterwards.
const SUNDAY = '2099-03-01';
const SECTIONS = [
  { kind: 'reading1', title: 'First Reading', citation: 'Test 1:1', text: 'SYNTHETIC PREP FIRST READING (not scripture)' },
  { kind: 'gospel', title: 'Gospel', citation: 'Test 5:7', text: 'SYNTHETIC PREP GOSPEL (not scripture)' },
];

test.describe('Sunday prep', () => {
  test.describe.configure({ mode: 'serial' });
  let admin: SupabaseClient | undefined;

  test.beforeAll(async () => {
    if (!seeded) return;
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const r = await admin.from('readings').upsert({
      date: SUNDAY,
      feast: 'Synthetic Prep Sunday',
      season: 'ordinary',
      color: 'green',
      sections: SECTIONS,
      source_url: 'https://example.invalid/synthetic-prep',
    });
    if (r.error) throw r.error;
    const f = await admin.from('reflections').upsert({
      date: SUNDAY,
      text: 'SYNTHETIC PREP REFLECTION',
      questions: ['Synthetic question one?', 'Synthetic question two?'],
    });
    if (f.error) throw f.error;
  });

  test.afterAll(async () => {
    if (admin) await admin.from('readings').delete().eq('date', SUNDAY);
  });

  test('a weekday date opens the coming Sunday, with links to the Sundays around it', async ({ page }) => {
    await page.goto('/sunday?date=2099-02-25');
    await expect(page.getByText('Sunday prep · Sun, Mar 1, 2099')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Previous Sunday' })).toHaveAttribute('href', '/sunday?date=2099-02-22');
    await expect(page.getByRole('link', { name: 'Next Sunday' })).toHaveAttribute('href', '/sunday?date=2099-03-08');
    await expect(page.getByRole('link', { name: 'Follow the Mass' })).toHaveAttribute('href', `/mass?date=${SUNDAY}`);
  });

  test('seeded: readings, reflection and AI questions', async ({ page }) => {
    test.skip(!seeded, 'needs SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY');
    await page.goto(`/sunday?date=${SUNDAY}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Synthetic Prep Sunday');
    const readings = page.getByTestId('prep-readings');
    await expect(readings).toContainText('SYNTHETIC PREP FIRST READING');
    await expect(readings).toContainText('SYNTHETIC PREP GOSPEL');
    const questions = page.getByTestId('prep-questions');
    await expect(questions).toContainText('Written by AI');
    await expect(questions.getByRole('listitem')).toHaveText(['Synthetic question one?', 'Synthetic question two?']);
    await expect(page.getByTestId('reflection')).toBeVisible();
  });

  test('an unsaved Sunday says so and links to USCCB', async ({ page }) => {
    await page.goto('/sunday?date=2099-05-03');
    await expect(page.getByTestId('no-readings')).toContainText("aren't saved yet");
  });

  test('no horizontal scroll at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/sunday?date=${SUNDAY}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
