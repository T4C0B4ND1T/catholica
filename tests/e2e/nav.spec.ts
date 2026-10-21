import { expect, test } from "@playwright/test";

const tabs = [
  { name: "Today", path: "/" },
  { name: "Mass", path: "/mass" },
  { name: "Bulletin", path: "/bulletin" },
  { name: "Me", path: "/me" },
];

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("four tabs are 44px+ tall, navigate, and mark the current page", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const tab of tabs) {
      const link = nav.getByRole("link", { name: tab.name });
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${tab.path === "/" ? "/$" : tab.path + "$"}`));
      await expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  test("bar is fixed at the bottom and does not cover the last content", async ({ page }) => {
    await page.goto("/me");
    const bar = await page.getByRole("navigation", { name: "Primary" }).boundingBox();
    expect(bar!.y + bar!.height).toBeCloseTo(844, 0);
    const main = await page.locator("main").evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(main).toBeGreaterThanOrEqual(bar!.height);
  });

  test("manifest and icons are served", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m.name).toBe("Catholica");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#FAFAF8");
    for (const icon of m.icons) expect((await request.get(icon.src)).status()).toBe(200);
  });
});

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("bar is at the top", async ({ page }) => {
    await page.goto("/");
    const bar = await page.getByRole("navigation", { name: "Primary" }).boundingBox();
    expect(bar!.y).toBeLessThan(5);
  });
});
