// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useControlHover } from "./use-control-hover";

afterEach(cleanup);

function Icon({ start, stop }: { start: () => void; stop: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useControlHover(ref, start, stop);
  return <span ref={ref} data-testid="icon" />;
}

function setup(wrap: "button" | "link" | "none") {
  const start = vi.fn();
  const stop = vi.fn();
  const icon = <Icon start={start} stop={stop} />;
  render(
    wrap === "button" ? (
      <button type="button">{icon} Save</button>
    ) : wrap === "link" ? (
      <a href="/rate">{icon} Rate</a>
    ) : (
      <div>{icon}</div>
    ),
  );
  return { start, stop };
}

const pointer = (type: string) => ({ pointerType: type });

describe("useControlHover", () => {
  it("plays the icon when its button is hovered with a mouse, and settles it on leave", () => {
    const { start, stop } = setup("button");
    const button = screen.getByRole("button");
    fireEvent.pointerEnter(button, pointer("mouse"));
    expect(start).toHaveBeenCalledTimes(1);
    fireEvent.pointerLeave(button, pointer("mouse"));
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("works for links too", () => {
    const { start } = setup("link");
    fireEvent.pointerEnter(screen.getByRole("link"), pointer("pen"));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("ignores touch", () => {
    const { start, stop } = setup("button");
    const button = screen.getByRole("button");
    fireEvent.pointerEnter(button, pointer("touch"));
    fireEvent.pointerLeave(button, pointer("touch"));
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it("plays on keyboard focus and settles on blur", () => {
    const { start, stop } = setup("button");
    const button = screen.getByRole("button");
    const matches = vi
      .spyOn(button, "matches")
      .mockImplementation((selector) => selector === ":focus-visible");
    fireEvent.focus(button);
    expect(start).toHaveBeenCalledTimes(1);
    fireEvent.blur(button);
    expect(stop).toHaveBeenCalledTimes(1);
    matches.mockRestore();
  });

  it("doesn't play on a mouse click's focus", () => {
    const { start } = setup("button");
    const button = screen.getByRole("button");
    vi.spyOn(button, "matches").mockReturnValue(false);
    fireEvent.focus(button);
    expect(start).not.toHaveBeenCalled();
  });

  it("does nothing outside a control", () => {
    const { start } = setup("none");
    fireEvent.pointerEnter(screen.getByTestId("icon"), pointer("mouse"));
    expect(start).not.toHaveBeenCalled();
  });
});
