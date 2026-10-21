import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/mass', '/bulletin', '/me'];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Color contrast, ${colorScheme}`, () => {
    test.use({ colorScheme });

    for (const path of PAGES) {
      test(`${path} meets WCAG AA contrast`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        const found = results.violations.flatMap((v) =>
          v.nodes.map((n) => `${n.target.join(' ')}: ${n.failureSummary ?? v.help}`),
        );
        expect(found).toEqual([]);
      });
    }
  });
}
