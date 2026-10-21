import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// No page opens a Sheet yet, so bundle the real component with a tiny harness and mount it on a built page
// (which supplies the app's compiled CSS).
const harness = `
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Sheet } from "./src/components/ui/Sheet";
function App() {
  const [open, setOpen] = useState(false);
  return (<>
    <button id="trigger" onClick={() => setOpen(true)}>Open sheet</button>
    <Sheet open={open} onClose={() => setOpen(false)} title="Test sheet"><p id="body">Body</p></Sheet>
  </>);
}
const el = document.createElement("div");
document.body.appendChild(el);
createRoot(el).render(<App />);
`;

let bundle = "";
test.beforeAll(() => {
  bundle = execFileSync(
    "node_modules/.bin/esbuild",
    ["--bundle", "--minify", "--jsx=automatic", "--define:process.env.NODE_ENV=\"production\"", "--loader=tsx", "--sourcefile=harness.tsx"],
    { input: harness, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
});

test.beforeEach(async ({ page }) => {
  await page.goto("/auth/signin");
  await page.addScriptTag({ content: bundle });
  await page.locator("#trigger").click();
  await expect(page.getByRole("dialog", { name: "Test sheet" })).toBeVisible();
});

test("click inside the dialog's own padding keeps it open", async ({ page }) => {
  const box = (await page.locator("[data-sheet-body]").boundingBox())!;
  await page.mouse.click(box.x + 8, box.y + 8);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("backdrop click closes and focus returns to the trigger", async ({ page }) => {
  const box = (await page.getByRole("dialog").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, 10);
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("#trigger")).toBeFocused();
});

test("Escape closes and focus returns to the trigger", async ({ page }) => {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("#trigger")).toBeFocused();
});
