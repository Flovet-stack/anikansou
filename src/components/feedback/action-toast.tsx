"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { HugeiconsRefreshIcon } from "@/components/ui/hugeicons-refresh";
import { HugeiconsUndoIcon } from "@/components/ui/hugeicons-undo";

export const TOAST_MS = 5000;

export type ActionToastProps = {
  /** A new id restarts the timer; the same id keeps it running. */
  id: number;
  message: string;
  action?: { kind: "undo" | "retry"; onClick: () => void };
};

/**
 * Short confirmation with Undo, or an error with Try again (decision 0007
 * §3). Dismisses after 5 s. Shared by the deck and the Library.
 */
export function ActionToast({
  toast,
  onDismiss,
}: {
  toast: ActionToastProps | null;
  onDismiss: () => void;
}) {
  // The latest callback, so re-renders don't restart the timer.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  // Paused while the pointer or focus is on it (0007: never rush a reader).
  const [paused, setPaused] = useState(false);
  const id = toast?.id;
  useEffect(() => {
    if (id === undefined || paused) return;
    const timer = window.setTimeout(() => dismiss.current(), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [id, paused]);

  if (!toast) return null;
  const action = toast.action;
  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="fixed inset-x-4 bottom-[calc(var(--spacing-tabbar)+var(--spacing)*4+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-lg bg-surface-3 py-2 pr-2 pl-5 text-small shadow-float md:bottom-8 md:left-[calc(var(--spacing-rail)+var(--spacing)*8)] md:mx-0 lg:left-[calc(var(--spacing-sidebar)+var(--spacing)*8)]"
    >
      <span>{toast.message}</span>
      {action ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={action.onClick}
          aria-keyshortcuts={
            action.kind === "undo" ? "Control+Z Meta+Z" : undefined
          }
          className="text-accent-text"
        >
          {action.kind === "undo" ? (
            <HugeiconsUndoIcon size={18} aria-hidden />
          ) : (
            <HugeiconsRefreshIcon size={18} aria-hidden />
          )}
          {action.kind === "undo" ? "Undo" : "Try again"}
        </Button>
      ) : null}
    </div>
  );
}
