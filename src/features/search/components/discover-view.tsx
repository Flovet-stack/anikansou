"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { ActionToast } from "@/components/feedback/action-toast";
import { Button } from "@/components/ui/button";
import { useCardActions } from "@/features/library/card-actions";
import { EditSheet } from "@/features/library/components/edit-sheet";
import { TitleCard } from "@/features/library/components/title-card";
import { cn } from "@/lib/utils";

import {
  EMPTY_FILTERS,
  type Filters,
  SORTS,
  SORT_LABELS,
  type Sort,
  clearedFilters,
  hasFilters,
} from "../filters";
import {
  discoverHref,
  noResultsText,
  resultsText,
  shouldSearch,
} from "../logic";
import type { SearchPage } from "../types";
import { useSearch } from "../use-search";
import { ActiveFilters } from "./active-filters";
import { FilterMenus } from "./filter-menus";
import { FilterSheet } from "./filter-sheet";
import { SearchField } from "./search-field";

const GRID =
  "grid grid-cols-2 gap-x-4 gap-y-6 min-[600px]:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] min-[600px]:gap-x-8 min-[600px]:gap-y-10";

/**
 * Discover (specs 09 and 10, decisions 0018 and 0020): title search and
 * filters. Results update as you type or filter; signed-in fans can save from
 * the grid or the edit sheet; signed-out visitors are sent to log in and back.
 */
export function DiscoverView({
  initialQuery,
  initialFilters = EMPTY_FILTERS,
  initialPage,
  initialError = false,
  latestYear = new Date().getFullYear() + 1,
  signedIn,
}: {
  initialQuery: string;
  initialFilters?: Filters;
  initialPage: SearchPage | null;
  /** The server-side search failed: show the error and Try again. */
  initialError?: boolean;
  /** The catalog's latest year, which starts the Year menu. */
  latestYear?: number;
  signedIn: boolean;
}) {
  const search = useSearch({
    initialQuery,
    initialFilters,
    initialPage,
    initialError,
  });
  const actions = useCardActions(search.save);
  const router = useRouter();
  const { results, status, filters, input } = search;
  const fieldRef = useRef<HTMLInputElement>(null);
  const focusField = useCallback(() => fieldRef.current?.focus(), []);

  // Adult posters stay blurred until revealed, for this visit (0010).
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const reveal = useCallback((animeId: number) => {
    setRevealed((last) => new Set(last).add(animeId));
  }, []);

  const [sheetId, setSheetId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetCard =
    results?.cards.find((card) => card.animeId === sheetId) ?? null;
  const cardButtons = useRef(new Map<number, HTMLButtonElement>());

  const open = useCallback(
    (animeId: number) => {
      if (!signedIn) {
        // Log in, then come back to this search (spec 09 #15, spec 10 #12).
        const back = discoverHref(input, filters);
        router.push(`/auth/login?next=${encodeURIComponent(back)}`);
        return;
      }
      setSheetId(animeId);
      setSheetOpen(true);
    },
    [signedIn, router, input, filters],
  );

  // "Show more" moves focus to the first new card (spec 09 #12).
  const { focusRequest, undo } = search;
  useEffect(() => {
    if (focusRequest) cardButtons.current.get(focusRequest.target)?.focus();
  }, [focusRequest]);

  // Ctrl/Cmd+Z undoes the last change, as in the Library (not while typing).
  useEffect(() => {
    if (!signedIn) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey) return;
      if (event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      void undo();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [signedIn, undo]);

  const firstLoad = status === "loading" && results === null;
  const stale = status === "loading" && results !== null;
  const atCap = results !== null && results.total > 200 && !search.hasMore;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-title-l font-extrabold tracking-tight">
        Discover
      </h1>

      <div className="flex flex-col gap-3">
        <SearchField
          inputRef={fieldRef}
          value={input}
          autoFocus={initialQuery === "" && !hasFilters(initialFilters)}
          onChange={search.change}
          onSubmit={search.submit}
          onClear={search.clear}
        />
        <div className="hidden md:block">
          <FilterMenus
            filters={filters}
            latestYear={latestYear}
            onChange={search.changeFilters}
          />
        </div>
        <div className="flex md:hidden">
          <FilterSheet
            filters={filters}
            latestYear={latestYear}
            onApply={search.applyFilters}
          />
        </div>
        <ActiveFilters
          filters={filters}
          onChange={search.changeFilters}
          onEmptied={focusField}
        />
      </div>

      {!shouldSearch(input, filters) &&
      results === null &&
      status !== "error" ? (
        <p className="text-body text-muted-foreground">
          Find any anime by its English, romaji or Japanese title.
        </p>
      ) : null}

      {status === "error" ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-4 rounded-lg bg-surface-1 px-6 py-8"
        >
          <p className="text-body">Search isn&apos;t working right now.</p>
          <Button variant="secondary" onClick={search.retry}>
            Try again
          </Button>
        </div>
      ) : null}

      {firstLoad ? <ResultsSkeleton /> : null}

      {results && status !== "error" ? (
        results.total === 0 ? (
          <NoResults
            query={results.query}
            filters={results.filters}
            onClearSearch={search.clear}
            onClearFilters={() => {
              search.changeFilters(clearedFilters(filters));
              focusField();
            }}
          />
        ) : (
          <section
            aria-labelledby="results-heading"
            aria-busy={stale}
            className={cn(
              "flex flex-col gap-6 transition-opacity duration-(--duration-base)",
              stale && "opacity-50",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="results-heading"
                className="text-small font-semibold text-muted-foreground tabular-nums"
              >
                {resultsText(results.total, results.query)}
              </h2>
              <SortSelect
                sort={filters.sort}
                onChange={(sort) => search.changeFilters({ ...filters, sort })}
              />
            </div>
            <ul className={GRID}>
              {results.cards.map((card) => (
                <li key={card.animeId} data-card-item={card.animeId}>
                  <TitleCard
                    ref={(element) => {
                      if (element)
                        cardButtons.current.set(card.animeId, element);
                      else cardButtons.current.delete(card.animeId);
                    }}
                    card={card}
                    actions={signedIn}
                    context={
                      card.matchedTitle ? (
                        <p className="-mt-1 line-clamp-2 text-[0.8125rem] text-muted-foreground min-[600px]:text-small">
                          Also known as {card.matchedTitle}
                        </p>
                      ) : null
                    }
                    revealed={revealed.has(card.animeId)}
                    onReveal={() => reveal(card.animeId)}
                    onOpen={() => open(card.animeId)}
                    onToggleWatched={() => actions.toggleWatched(card)}
                    onToggleLike={() => actions.toggleLike(card)}
                    onToggleWatchlist={() => actions.toggleWatchlist(card)}
                  />
                </li>
              ))}
            </ul>
            {search.hasMore || search.loadError ? (
              <div className="flex flex-col items-center gap-3">
                {search.loadError ? (
                  <p role="alert" className="text-small text-danger">
                    {search.loadError}
                  </p>
                ) : null}
                <Button
                  variant="secondary"
                  onClick={() => void search.loadMore()}
                  disabled={search.loadingMore}
                >
                  {search.loadingMore
                    ? "Loading…"
                    : search.loadError
                      ? "Try again"
                      : "Show more"}
                </Button>
              </div>
            ) : null}
            {atCap ? (
              <p className="text-center text-small text-muted-foreground">
                Showing the first 200. Add a filter to narrow it down.
              </p>
            ) : null}
          </section>
        )
      ) : null}

      {signedIn ? (
        <>
          <EditSheet
            open={sheetOpen}
            card={sheetCard}
            onClose={() => setSheetOpen(false)}
            returnFocus={() =>
              sheetId === null
                ? null
                : (cardButtons.current.get(sheetId) ?? null)
            }
            onStatus={(next) => sheetCard && actions.setStatus(sheetCard, next)}
            onRate={(rating) => sheetCard && actions.rate(sheetCard, rating)}
            onToggleLike={() => sheetCard && actions.toggleLike(sheetCard)}
            onToggleWatchlist={() =>
              sheetCard && actions.toggleWatchlist(sheetCard)
            }
            onRemove={() => {
              if (!sheetCard) return;
              setSheetOpen(false);
              actions.remove(sheetCard);
            }}
          />
          <ActionToast toast={search.toast} onDismiss={search.dismissToast} />
        </>
      ) : null}

      {/* Once per settled search, never per keystroke (spec 09 #18). */}
      <p aria-live="polite" className="sr-only">
        {search.announcement}
      </p>
    </div>
  );
}

/** Spec 10 #10: the same pill select as the Library's sort. */
function SortSelect({
  sort,
  onChange,
}: {
  sort: Sort;
  onChange: (sort: Sort) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="text-small text-muted-foreground">
        Sort
      </label>
      <select
        id={id}
        value={sort}
        onChange={(event) => onChange(event.target.value as Sort)}
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

function NoResults({
  query,
  filters,
  onClearSearch,
  onClearFilters,
}: {
  query: string;
  filters: Filters;
  onClearSearch: () => void;
  onClearFilters: () => void;
}) {
  const filtered = hasFilters(filters);
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg bg-surface-1 px-6 py-10">
      <p className="font-display text-title-m font-extrabold break-words">
        {noResultsText(query, filters)}
      </p>
      <p className="max-w-reading text-body text-muted-foreground">
        {filtered
          ? "Try removing a filter."
          : "Check the spelling, or try another of its titles: the Japanese one or the English one."}
      </p>
      <Button
        variant="secondary"
        onClick={filtered ? onClearFilters : onClearSearch}
      >
        {filtered ? "Clear filters" : "Clear search"}
      </Button>
    </div>
  );
}

/** First search only: later searches keep the old results, dimmed. */
function ResultsSkeleton() {
  return (
    <ul aria-hidden className={GRID}>
      {Array.from({ length: 8 }, (_, card) => (
        <li key={card} className="flex flex-col gap-2">
          <div className="aspect-[2/3] animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none" />
          <div className="h-5 w-4/5 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
          <div className="h-4 w-1/2 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
        </li>
      ))}
    </ul>
  );
}
