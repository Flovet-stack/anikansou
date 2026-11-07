"use client";

import { useEffect, useId, useRef } from "react";

import { HugeiconsSearchIcon } from "@/components/ui/hugeicons-search";
import { HugeiconsXIcon } from "@/components/ui/hugeicons-x";

import { MAX_QUERY_CHARS } from "../logic";

/**
 * The search field (decision 0018): a search landmark with a visible label,
 * a clear button, Enter to search now and Esc to clear. Autofocus only on
 * pointer devices (on touch it would open the keyboard over the page).
 */
export function SearchField({
  value,
  autoFocus,
  onChange,
  onSubmit,
  onClear,
}: {
  value: string;
  /** Focus on open when there's no query yet. */
  autoFocus: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, [autoFocus]);

  return (
    <form
      role="search"
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor={id} className="text-small font-semibold">
        Search anime
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground">
          <HugeiconsSearchIcon size={22} aria-hidden />
        </span>
        <input
          ref={input}
          id={id}
          type="search"
          name="q"
          value={value}
          maxLength={MAX_QUERY_CHARS}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Title in English, romaji or Japanese"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && value !== "") {
              event.preventDefault();
              onClear();
            }
          }}
          className="min-h-14 w-full min-w-0 rounded-md border border-transparent bg-surface-2 pr-14 pl-12 text-body text-foreground transition-colors duration-(--duration-hover-out) ease-in-out outline-none placeholder:text-text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kohaku hover-fine:border-border hover-fine:duration-(--duration-fast) [&::-webkit-search-cancel-button]:hidden"
        />
        {value !== "" ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onClear();
              input.current?.focus();
            }}
            className="absolute top-1/2 right-1.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--duration-hover-out) focus-visible:outline-2 focus-visible:outline-kohaku hover-fine:bg-surface-3 hover-fine:text-foreground"
          >
            <HugeiconsXIcon size={20} aria-hidden />
          </button>
        ) : null}
      </div>
    </form>
  );
}
