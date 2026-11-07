"use client";

import { type RefObject, useEffect, useRef } from "react";

/** The interactive element an icon sits in. */
const CONTROL = "a[href], button, [role='button'], [role='tab'], summary";

/**
 * Plays an animated icon when the button or link around it is hovered with a
 * mouse or pen, or focused from the keyboard, and settles it when the pointer
 * leaves or focus moves away (brief: icons animate on interaction; 0003).
 * Touch taps don't start it. Returns whether the icon found a control, so the
 * icon's own hover handlers can stand down and not play it twice.
 */
export function useControlHover(
  iconRef: RefObject<HTMLElement | null>,
  start: () => void,
  stop: () => void,
): RefObject<boolean> {
  const hasControl = useRef(false);
  // Latest callbacks without re-binding listeners on every render.
  const handlers = useRef({ start, stop });
  useEffect(() => {
    handlers.current = { start, stop };
  });

  useEffect(() => {
    const control = iconRef.current?.parentElement?.closest(CONTROL);
    if (!(control instanceof HTMLElement)) return;
    hasControl.current = true;

    const onEnter = (event: PointerEvent) => {
      if (event.pointerType !== "touch") handlers.current.start();
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType !== "touch") handlers.current.stop();
    };
    const onFocus = () => {
      // Keyboard focus only; a mouse click focuses too but already hovered.
      if (control.matches(":focus-visible")) handlers.current.start();
    };
    const onBlur = () => handlers.current.stop();

    control.addEventListener("pointerenter", onEnter);
    control.addEventListener("pointerleave", onLeave);
    control.addEventListener("focus", onFocus);
    control.addEventListener("blur", onBlur);
    return () => {
      hasControl.current = false;
      control.removeEventListener("pointerenter", onEnter);
      control.removeEventListener("pointerleave", onLeave);
      control.removeEventListener("focus", onFocus);
      control.removeEventListener("blur", onBlur);
    };
  }, [iconRef]);

  return hasControl;
}
