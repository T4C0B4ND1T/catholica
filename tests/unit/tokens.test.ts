import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../../src/app/globals.css"), "utf8");

const light = {
  background: "#FAFAF8",
  foreground: "#1A1A1A",
  muted: "#F5F3F0",
  "muted-foreground": "#6B6B6B",
  card: "#FFFFFF",
  border: "#E8E4DF",
  accent: "#B8860B",
  "accent-secondary": "#D4A84B",
};
const dark = {
  background: "#161513",
  foreground: "#F2EFEA",
  muted: "#211F1C",
  "muted-foreground": "#A8A29A",
  card: "#1D1B19",
  border: "#34302B",
  accent: "#D4A84B",
  "accent-secondary": "#E2BE6E",
};

/** Body of the first rule whose selector line matches `selector`. */
function block(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `selector ${selector} present`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("design tokens", () => {
  it.each(Object.entries(light))("light --%s", (name, value) => {
    expect(block(":root {")).toContain(`--${name}: ${value}`);
  });

  it.each(Object.entries(dark))("dark --%s", (name, value) => {
    expect(block('[data-theme="dark"]')).toContain(`--${name}: ${value}`);
  });

  it("auto dark follows the system unless light is forced", () => {
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain(':root:not([data-theme="light"])');
  });

  it("defines small-caps, reduced motion and text scale", () => {
    expect(css).toContain(".small-caps");
    expect(css).toContain("letter-spacing: 0.15em");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("var(--text-scale, 1)");
  });
});
