import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
const seeded = Boolean(url && serviceKey);

// 2099-01-04 is a Sunday. Clearly synthetic row, removed afterwards.
const SUNDAY = '2099-01-04';
const GOSPEL_TEXT = 'SYNTHETIC TEST GOSPEL TEXT (not scripture)';

async function scrollTo(page: Page, id: string) {
  await page.locator(`#${id}`).evaluate((el) => el.scrollIntoView({ block: 'start' }));
}

test.describe('Mass tab', () => {
  let admin: SupabaseClient | undefined;

  test.beforeAll(async () => {
    if (!seeded) return;
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.from('readings').upsert({
      date: SUNDAY,
      feast: 'Synthetic Test Sunday',
      season: 'ordinary',
      color: 'green',
      sections: [{ kind: 'gospel', title: 'Gospel', citation: 'Test 1:1', text: GOSPEL_TEXT }],
      source_url: 'https://example.invalid/synthetic',
    });
    if (error) throw error;
  });

  test.afterAll(async () => {
    await admin?.from('readings').delete().eq('date', SUNDAY);
  });

  test('seeded Sunday shows the Gospel text inside the Gospel step', async ({ page }) => {
    test.skip(!seeded, 'needs SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY');
    await page.goto(`/mass?date=${SUNDAY}`);
    const gospel = page.locator('#holy-gospel');
    await expect(gospel.getByText(GOSPEL_TEXT)).toBeVisible();
    await expect(gospel.getByRole('link', { name: 'Source: USCCB' })).toHaveAttribute(
      'href',
      'https://example.invalid/synthetic',
    );
  });

  test('without readings the reading steps show their summary', async ({ page }) => {
    await page.goto('/mass?date=2098-06-06');
    await expect(page.locator('#holy-gospel [data-testid^="reading-"]')).toHaveCount(0);
    await expect(page.locator('#holy-gospel')).toContainText('pinnacle of the Liturgy of the Word');
  });

  test('invalid date falls back to today', async ({ page }) => {
    const res = await page.goto('/mass?date=not-a-date');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Order of the Mass' })).toBeVisible();
  });

  test('posture badge follows scroll: Creed is Stand, Eucharistic Prayer is Kneel', async ({ page }) => {
    await page.goto('/mass');
    const badge = page.getByTestId('posture-badge');
    await scrollTo(page, 'profession-of-faith');
    await expect(badge).toContainText('Stand');
    await scrollTo(page, 'consecration-eucharistic-prayer');
    await expect(badge).toContainText('Kneel');
    await scrollTo(page, 'homily');
    await expect(badge).toContainText('Sit');
  });
});
