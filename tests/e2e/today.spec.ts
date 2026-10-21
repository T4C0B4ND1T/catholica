import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { formatDay, todayInChicago } from '../../src/lib/dates';

const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
const seeded = Boolean(url && serviceKey);

// 2099-02-01 is a Sunday and 2099-01-28 the Wednesday before it. Clearly synthetic rows, removed afterwards.
// Other specs use 2099-01-04 and a 2099 bulletin, so these dates avoid theirs.
const SUNDAY = '2099-02-01';
const WEDNESDAY = '2099-01-28';
const TWINS = '2099-02-08'; // a Sunday with two sections of the same kind
const BULLETIN = '2098-01-04'; // older than any other spec's bulletin so it never changes their "latest"
const SOURCE = 'https://example.invalid/synthetic-readings';

const SECTIONS = [
  { kind: 'reading1', title: 'First Reading', citation: 'Test 1:1-3', text: 'SYNTHETIC FIRST READING (not scripture)' },
  { kind: 'psalm', title: 'Responsorial Psalm', citation: 'Test 2:1', text: 'SYNTHETIC PSALM (not scripture)' },
  { kind: 'reading2', title: 'Second Reading', citation: 'Test 3:1', text: 'SYNTHETIC SECOND READING (not scripture)' },
  { kind: 'alleluia', title: 'Alleluia', citation: 'Test 4:1', text: 'SYNTHETIC ALLELUIA (not scripture)' },
  { kind: 'gospel', title: 'Gospel', citation: 'Test 5:7', text: 'SYNTHETIC GOSPEL TEXT (not scripture)' },
];

test.describe('Today tab', () => {
  // One worker: beforeAll/afterAll seed and delete shared rows.
  test.describe.configure({ mode: 'serial' });
  let admin: SupabaseClient | undefined;

  test.beforeAll(async () => {
    if (!seeded) return;
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const base = { season: 'ordinary', color: 'green', source_url: SOURCE, fetched_at: '2099-01-01T14:05:00Z' };
    const rows = await admin.from('readings').upsert([
      { ...base, date: SUNDAY, feast: 'Synthetic Test Sunday', sections: SECTIONS },
      {
        ...base,
        date: WEDNESDAY,
        feast: 'Synthetic Test Wednesday',
        sections: [{ kind: 'gospel', title: 'Gospel', citation: 'Test 9:9', text: 'SYNTHETIC WEEKDAY GOSPEL (not scripture)' }],
      },
      {
        ...base,
        date: TWINS,
        feast: 'Synthetic Twin Sunday',
        sections: [
          { kind: 'other', title: 'Option One', citation: 'Test 7:1', text: 'SYNTHETIC OPTION ONE TEXT' },
          { kind: 'other', title: 'Option Two', citation: 'Test 7:2', text: 'SYNTHETIC OPTION TWO TEXT' },
        ],
      },
    ]);
    if (rows.error) throw rows.error;
    const reflection = await admin
      .from('reflections')
      .upsert({ date: SUNDAY, text: 'SYNTHETIC REFLECTION TEXT (not real)', model: 'synthetic' });
    if (reflection.error) throw reflection.error;
    const bulletin = await admin
      .from('bulletins')
      .upsert({ sunday_date: BULLETIN, source_url: 'https://example.invalid/b.pdf', storage_path: 'e2e-synthetic/none.pdf', page_count: 1, text: 'synthetic' });
    if (bulletin.error) throw bulletin.error;
  });

  test.afterAll(async () => {
    if (!admin) return;
    await admin.from('reflections').delete().eq('date', SUNDAY);
    await admin.from('readings').delete().in('date', [SUNDAY, WEDNESDAY, TWINS]);
    await admin.from('bulletins').delete().eq('sunday_date', BULLETIN);
  });

  test.describe('360px', () => {
    test.use({ viewport: { width: 360, height: 780 } });

    test('no page overflow and the Gospel pill brings its card into view', async ({ page }) => {
      test.skip(!seeded, 'needs SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY');
      await page.goto(`/?date=${SUNDAY}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.getByRole('navigation', { name: 'Readings' }).getByRole('button', { name: 'Gospel' }).click();
      const gospel = page.locator('[data-card="gospel"]');
      await expect
        .poll(async () => {
          const box = (await gospel.boundingBox())!;
          return box.x >= 0 && box.x + box.width <= 360;
        })
        .toBe(true);
    });
  });

  test('two sections of the same kind get distinct cards and pills', async ({ page }) => {
    test.skip(!seeded, 'needs SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY');
    await page.goto(`/?date=${TWINS}`);
    await expect(page.locator('[data-card="other"]')).toHaveCount(2);
    const ids = await page.locator('[data-card]').evaluateAll((els) => els.map((e) => e.id));
    expect(new Set(ids).size).toBe(2);
    const pills = page.getByRole('navigation', { name: 'Readings' }).getByRole('button');
    await expect(pills).toHaveCount(2);
    await pills.nth(1).click();
    await expect(pills.nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-card="other"]').nth(1)).toContainText('SYNTHETIC OPTION TWO TEXT');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`seeded Sunday in ${scheme}: feast, Gospel in two taps, reflection, footer`, async ({ page }) => {
      test.skip(!seeded, 'needs SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY');
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/?date=${SUNDAY}`);

      await expect(page.getByRole('heading', { level: 1, name: 'Synthetic Test Sunday' })).toBeVisible();
      await expect(page.getByText('Year B · Week I')).toBeVisible();

      // No page-level horizontal scroll; the carousel scrolls inside itself.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      // Tap one: the Gospel pill. Tap two is not needed once the card is in view.
      const pill = page.getByRole('navigation', { name: 'Readings' }).getByRole('button', { name: 'Gospel' });
      expect((await pill.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await pill.click();
      const gospel = page.locator('[data-card="gospel"]');
      await expect(gospel).toContainText('SYNTHETIC GOSPEL TEXT');
      await expect
        .poll(async () => {
          const box = (await gospel.boundingBox())!;
          return box.x >= 0 && box.x + box.width <= 390;
        })
        .toBe(true);

      // Reading text style.
      const style = await gospel.locator('p.whitespace-pre-line').evaluate((el) => {
        const s = getComputedStyle(el);
        return { size: s.fontSize, line: parseFloat(s.lineHeight) / parseFloat(s.fontSize) };
      });
      expect(style.size).toBe('19px');
      expect(style.line).toBeCloseTo(1.75, 2);

      // Reflection: labeled, collapsed, and outside every reading card.
      const reflection = page.getByTestId('reflection');
      await expect(reflection.getByText('AI reflection', { exact: true })).toBeVisible();
      await expect(reflection.locator('p', { hasText: 'SYNTHETIC REFLECTION' })).toBeHidden();
      await reflection.getByText('AI reflection').click();
      await expect(reflection.getByText('SYNTHETIC REFLECTION TEXT')).toBeVisible();
      await expect(page.locator('[data-card]').getByText('SYNTHETIC REFLECTION')).toHaveCount(0);

      // Sunday: no This Sunday card.
      await expect(page.getByTestId('this-sunday')).toHaveCount(0);

      await expect(page.getByRole('link', { name: 'Source: USCCB' })).toHaveAttribute('href', SOURCE);
      await expect(page.getByText(/Updated \d{1,2}:\d{2} (AM|PM)/)).toBeVisible();
      await expect(page.getByRole('link', { name: 'Follow the Mass' })).toHaveAttribute('href', `/mass?date=${SUNDAY}`);
    });
  }

  test('seeded Wednesday shows the This Sunday card with feast, Gospel citation and bulletin', async ({ page }) => {
    test.skip(!seeded, 'needs SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY');
    await page.goto(`/?date=${WEDNESDAY}`);
    const card = page.getByTestId('this-sunday');
    await expect(card).toContainText('Synthetic Test Sunday');
    await expect(card).toContainText('Test 5:7');
    await expect(card.getByRole('link', { name: 'Open bulletin' })).toHaveAttribute('href', /^\/bulletin\/\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByTestId('reflection')).toHaveCount(0);
  });

  test('unseeded date shows the USCCB fallback and no error text', async ({ page }) => {
    await page.goto('/?date=2098-06-06');
    await expect(page.getByText("Readings for this day aren't saved yet.")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open on USCCB' })).toHaveAttribute(
      'href',
      'https://bible.usccb.org/bible/readings/060698.cfm',
    );
    await expect(page.getByText(/error|failed|went wrong/i)).toHaveCount(0);
    await expect(page.getByTestId('reflection')).toHaveCount(0);
  });

  test('invalid or out-of-range date falls back to today', async ({ page }) => {
    for (const d of ['not-a-date', '2500-01-01', '2026-02-30']) {
      const res = await page.goto(`/?date=${d}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole('button', { name: formatDay(todayInChicago()) })).toBeVisible();
    }
  });

  test('date chip opens the calendar and picking a day navigates', async ({ page }) => {
    await page.goto('/?date=2098-06-06');
    await page.getByRole('button', { name: /Jun 6, 2098/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Choose a day' });
    await expect(dialog.getByText('June 2098')).toBeVisible();
    await dialog.getByRole('button', { name: 'Next month' }).click();
    await dialog.getByRole('button', { name: 'Tue, Jul 15, 2098' }).click();
    await expect(page).toHaveURL(/\/\?date=2098-07-15$/);
  });
});
