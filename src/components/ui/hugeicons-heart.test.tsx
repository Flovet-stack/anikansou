// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HugeiconsHeartIcon } from "./hugeicons-heart";

// A real vendored icon inside a button (spec 06). The icon's start checks
// `prefers-reduced-motion` on every real start, so counting those lookups
// after mount counts the starts that went ahead.
const REDUCE = "(prefers-reduced-motion: reduce)";

function mockMotionPreference(reduce: boolean) {
  const lookups = vi.fn();
  vi.stubGlobal("matchMedia", (query: string) => {
    lookups(query);
    return {
      matches: query === REDUCE ? reduce : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  });
  return () => lookups.mock.calls.filter(([query]) => query === REDUCE).length;
}

function renderInButton() {
  render(
    <button type="button">
      <HugeiconsHeartIcon size={20} aria-hidden data-testid="icon" />
      Like
    </button>,
  );
  return {
    button: screen.getByRole("button"),
    icon: screen.getByTestId("icon"),
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("vendored icon inside a control", () => {
  it("starts once when the button is hovered, not again over the icon", () => {
    const starts = mockMotionPreference(false);
    const { button, icon } = renderInButton();
    const before = starts();
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(starts() - before).toBe(1);
    // The icon's own handlers stand down: no second start, and leaving the
    // icon while still inside the button doesn't stop it.
    fireEvent.mouseEnter(icon);
    fireEvent.mouseLeave(icon);
    expect(starts() - before).toBe(1);
  });

  it("doesn't start on a touch tap", () => {
    const starts = mockMotionPreference(false);
    const { button, icon } = renderInButton();
    const before = starts();
    fireEvent.pointerEnter(button, { pointerType: "touch" });
    // Browsers follow a tap with compatibility mouse events on the target.
    fireEvent.mouseEnter(icon);
    expect(starts() - before).toBe(0);
  });

  it("doesn't animate under reduced motion", () => {
    const starts = mockMotionPreference(true);
    const { button } = renderInButton();
    const before = starts();
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    // The stored preference stops the start before it checks again or runs.
    expect(starts() - before).toBe(0);
  });
});
