"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef } from "react";

import { cn } from "@/lib/utils";

import { libraryHref, shelfTabLabel, visibleShelves } from "../logic";
import { parseSort } from "../types";
import {
  SHELF_LABELS,
  SORTS,
  SORT_LABELS,
  type Shelf,
  type ShelfCounts,
  type Sort,
} from "../types";

/** The remembered sort (0016: per user, in local storage). */
export const SORT_KEY = "anikansou.library.sort";

/**
 * Shelf tabs (0016): links, so each shelf has its own URL. They scroll
 * sideways on phones and keep the active one in view.
 */
export function ShelfTabs({
  shelf,
  sort,
  counts,
}: {
  shelf: Shelf;
  sort: Sort;
  counts: ShelfCounts;
}) {
  const list = useRef<HTMLUListElement>(null);
  const active = useRef<HTMLAnchorElement>(null);
  // Scrolls only the tab row (never the page) to centre the active tab.
  useEffect(() => {
    const row = list.current;
    const tab = active.current?.parentElement;
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
  }, [shelf]);

  return (
    <nav aria-label="Shelves" className="-mx-4 md:mx-0">
      <ul
        ref={list}
        className="flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 md:flex-wrap md:px-0"
      >
        {visibleShelves(counts, shelf).map((tab) => {
          const current = tab === shelf;
          return (
            <li key={tab} className="shrink-0">
              <Link
                ref={current ? active : undefined}
                href={libraryHref(tab, sort)}
                aria-current={current ? "page" : undefined}
                aria-label={shelfTabLabel(tab, counts[tab])}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-small font-semibold transition-[background-color,color,transform] duration-(--duration-hover-out) ease-in-out active:scale-[0.97] hover-fine:duration-(--duration-fast)",
                  current
                    ? "bg-surface-3 text-foreground"
                    : "bg-surface-1 text-muted-foreground hover-fine:bg-surface-2 hover-fine:text-foreground",
                )}
              >
                {SHELF_LABELS[tab]}
                <span
                  className={cn(
                    "tabular-nums",
                    current ? "text-accent-text" : "text-text-subtle",
                  )}
                >
                  {counts[tab]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The sort menu (0016). The choice goes in the URL and is remembered; a
 * visit without `?sort=` switches to the remembered one.
 */
export function SortMenu({
  shelf,
  sort,
  sortInUrl,
}: {
  shelf: Shelf;
  sort: Sort;
  sortInUrl: boolean;
}) {
  const router = useRouter();
  const id = useId();

  useEffect(() => {
    if (sortInUrl) {
      remember(sort);
      return;
    }
    let stored: Sort | null = null;
    try {
      stored = parseSort(localStorage.getItem(SORT_KEY));
    } catch {
      // Storage blocked: the default sort it is.
    }
    if (stored && stored !== sort) {
      router.replace(libraryHref(shelf, stored), { scroll: false });
    }
  }, [router, shelf, sort, sortInUrl]);

  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="text-small text-muted-foreground">
        Sort
      </label>
      <select
        id={id}
        value={sort}
        onChange={(event) => {
          const next = parseSort(event.target.value);
          if (!next) return;
          remember(next);
          router.push(libraryHref(shelf, next), { scroll: false });
        }}
        className="min-h-11 rounded-full bg-surface-2 px-4 pr-8 text-small font-semibold text-foreground transition-colors hover-fine:bg-surface-3"
      >
        {SORTS.map((option) => (
          <option key={option} value={option}>
            {SORT_LABELS[option]}
          </option>
        ))}
      </select>
    </div>
  );
}

function remember(sort: Sort) {
  try {
    localStorage.setItem(SORT_KEY, sort);
  } catch {
    // Storage blocked: it just won't be remembered.
  }
}
