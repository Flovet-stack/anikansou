"use client";

import { useEffect, useRef } from "react";

import { HugeiconsXIcon } from "@/components/ui/hugeicons-x";

import { type Filters, clearedFilters, filterChips } from "../filters";

/**
 * The active filters as removable chips, then Clear filters (decision 0020).
 * Removing a chip keeps keyboard focus nearby rather than dropping it.
 */
export function ActiveFilters({
  filters,
  onChange,
  onEmptied,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  /** No chips left, so focus goes back to the search field. */
  onEmptied: () => void;
}) {
  const chips = filterChips(filters);
  const list = useRef<HTMLUListElement>(null);
  /** The removed chip's place: focus lands there once it has gone. */
  const refocus = useRef<number | null>(null);

  useEffect(() => {
    if (refocus.current === null) return;
    const buttons = list.current?.querySelectorAll("button");
    const target = buttons?.[Math.min(refocus.current, buttons.length - 1)];
    refocus.current = null;
    if (target) target.focus();
    else onEmptied();
  }, [filters, onEmptied]);

  if (chips.length === 0) return null;
  return (
    <ul ref={list} aria-label="Active filters" className="flex flex-wrap gap-2">
      {chips.map((chip, index) => (
        <li key={chip.key}>
          <button
            type="button"
            aria-label={`Remove filter: ${chip.label}`}
            onClick={() => {
              refocus.current = index;
              onChange(chip.without);
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface-1 pr-3 pl-4 text-small font-semibold text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-kohaku md:min-h-9 hover-fine:bg-surface-2"
          >
            {chip.label}
            <HugeiconsXIcon size={14} aria-hidden />
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={() => {
            onChange(clearedFilters(filters));
            onEmptied();
          }}
          className="inline-flex min-h-11 items-center rounded-full px-3 text-small font-semibold text-accent-text focus-visible:outline-2 focus-visible:outline-kohaku md:min-h-9 hover-fine:underline"
        >
          Clear filters
        </button>
      </li>
    </ul>
  );
}
