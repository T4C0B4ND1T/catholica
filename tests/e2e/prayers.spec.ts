import { expect, test } from '@playwright/test';

test.describe('Prayer library', () => {
  test('lists the prayers and opens one', async ({ page }) => {
    await page.goto('/prayers');
    await expect(page.getByRole('heading', { level: 1, name: 'Prayers' })).toBeVisible();
    await page.getByRole('link', { name: 'Memorare' }).click();
    await expect(page).toHaveURL(/\/prayers\/memorare$/);
    await expect(page.getByTestId('prayer-text')).toContainText('Remember, O most gracious Virgin Mary');
  });

  test("the Rosary marks today's mysteries", async ({ page }) => {
    await page.goto('/prayers/rosary');
    await expect(page.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(page.locator('[aria-current="true"]')).toContainText('Today');
  });

  test('an unknown prayer is 404', async ({ page }) => {
    expect((await page.goto('/prayers/not-a-prayer'))?.status()).toBe(404);
  });

  test('the Prayers tab opens the library', async ({ page }) => {
    await page.goto('/me');
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Prayers' }).click();
    await expect(page).toHaveURL(/\/prayers$/);
  });
});

test.describe('Today calendar notes', () => {
  test('names an optional memorial on a weekday', async ({ page }) => {
    await page.goto('/?date=2099-10-22');
    await expect(page.getByTestId('saints-of-day')).toContainText('St. John Paul II');
  });

  test('flags a holy day of obligation in the coming week', async ({ page }) => {
    await page.goto('/?date=2099-12-08');
    await expect(page.getByTestId('holy-day')).toContainText('The Immaculate Conception');
  });
});
