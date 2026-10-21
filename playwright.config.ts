import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Use the preinstalled browser when present (cloud sandbox); CI installs its own.
const localChromium = ["/opt/pw-browsers/chromium", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(
  (p) => existsSync(p),
);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    ...devices["Pixel 5"],
    viewport: { width: 390, height: 844 },
    launchOptions: localChromium ? { executablePath: localChromium } : {},
  },
  // Production build: what ships is what gets tested.
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Point the app at the same Supabase the tests seed, when one is provided.
    env: {
      ...(process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_ANON_KEY
        ? {
            NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_TEST_URL,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_TEST_ANON_KEY,
            // The signed-in e2e user (tests/e2e/me.spec.ts) must pass the allowlist.
            ALLOWED_EMAIL: "me-e2e@catholica.test",
          }
        : {}),
    },
  },
});
