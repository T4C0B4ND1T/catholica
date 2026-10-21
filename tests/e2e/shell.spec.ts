import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("home responds 200 and does not scroll horizontally", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Catholica" })).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test("saved dark theme is applied before paint", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("catholica.theme", "dark"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(22, 21, 19)");
});
