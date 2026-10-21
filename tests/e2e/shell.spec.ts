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

test("saved light theme on a dark system never flashes dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    localStorage.setItem("catholica.theme", "light");
    localStorage.setItem("catholica.textScale", "1.3");
    const seen: (string | null)[] = [];
    (window as unknown as { __themes: typeof seen }).__themes = seen;
    new MutationObserver(() => seen.push(document.documentElement.getAttribute("data-theme"))).observe(
      document.documentElement,
      { attributes: true, attributeFilter: ["data-theme"] },
    );
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-text-scale", "1.3");
  const seen = await page.evaluate(() => (window as unknown as { __themes: string[] }).__themes);
  expect(seen).not.toContain("dark");
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--text-scale"))).toBe("1.3");
});
