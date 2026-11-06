// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const setTheme = vi.fn();
let theme = "dark";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: theme, setTheme }),
}));

const { ThemeToggle } = await import("./theme-toggle");
const { FORCED_THEME } = await import("./theme-provider");

beforeAll(() => {
  // jsdom has no matchMedia; the animated icons read it for reduced motion.
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList;
});

afterEach(() => {
  cleanup();
  setTheme.mockClear();
});

// The toggle stays in the code, working, but isn't rendered while the product
// is dark only (decision 0012).
describe("ThemeToggle", () => {
  it("switches dark to light", () => {
    theme = "dark";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch theme" }));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("switches light to dark", () => {
    theme = "light";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch theme" }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});

describe("ThemeProvider", () => {
  it("forces the dark theme", () => {
    expect(FORCED_THEME).toBe("dark");
  });
});
