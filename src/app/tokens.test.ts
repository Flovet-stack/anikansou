import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Reads the real stylesheet, so a changed token can't pass this test silently.
const css = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  const value = match?.[1];
  if (!value) throw new Error(`Token --${name} is missing or not a hex colour`);
  return value;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const value = parseInt(hex.slice(i, i + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2.x contrast ratio between two colours. */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// [foreground, background, ratio stated in the decision]
const pairs: [string, string, number][] = [
  // 0001, dark theme
  ["text", "bg", 17.6],
  ["text", "surface-2", 15.1],
  ["text-muted", "bg", 9.1],
  ["text-muted", "surface-2", 7.8],
  ["text-subtle", "bg", 5.8],
  ["kohaku", "bg", 10.2],
  ["on-accent", "kohaku", 10.2],
  ["accent-text", "bg", 10.2],
  ["success", "bg", 9.7],
  ["danger", "bg", 5.7],
  // 0005, dark column, on bg and on surface-2
  ["state-like", "bg", 7.1],
  ["state-watchlist", "bg", 8.1],
  ["state-watched", "bg", 10.4],
  ["state-watching", "bg", 9.6],
  ["state-onhold", "bg", 10.5],
  ["state-dropped", "bg", 6.8],
  ["state-like", "surface-2", 4.5],
  ["state-watchlist", "surface-2", 4.5],
  ["state-watched", "surface-2", 4.5],
  ["state-watching", "surface-2", 4.5],
  ["state-onhold", "surface-2", 4.5],
  ["state-dropped", "surface-2", 4.5],
];

describe("design tokens", () => {
  it.each(pairs)("%s on %s meets %d:1", (fg, bg, stated) => {
    // The decisions state ratios computed from OKLCH and rounded to one
    // decimal; the hex values are rounded too. Allow for that, never more.
    const ratio = contrast(token(fg), token(bg));
    expect(ratio).toBeGreaterThanOrEqual(stated - 0.1);
    // Whatever the rounding, text never drops below WCAG AA.
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("defines no light theme (0012)", () => {
    expect(css).not.toMatch(/prefers-color-scheme:\s*light/);
    expect(css).not.toMatch(/^\.light\b|\[data-theme="light"\]/m);
  });

  it("computes known WCAG ratios", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
});
