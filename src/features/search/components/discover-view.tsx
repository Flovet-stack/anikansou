"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ActionToast } from "@/components/feedback/action-toast";
import { Button } from "@/components/ui/button";
import { useCardActions } from "@/features/library/card-actions";
import { EditSheet } from "@/features/library/components/edit-sheet";
import { TitleCard } from "@/features/library/components/title-card";
import { cn } from "@/lib/utils";

import { discoverHref, isSearchable, resultsText } from "../logic";
import type { SearchPage } from "../types";
import { useSearch } from "../use-search";
import { SearchField } from "./search-field";

const GRID =
  "grid grid-cols-2 gap-x-4 gap-y-6 min-[600px]:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] min-[600px]:gap-x-8 min-[600px]:gap-y-10";

/**
 * Discover (spec 09, decision 0018): for now, title search only. Results
 * update as you type; signed-in fans can save from the grid or the edit
 * sheet; signed-out visitors are sent to log in and back.
 */
export function DiscoverView({
  initialQuery,
  initialPage,
  initialError = false,
  signedIn,
}: {
  initialQuery: string;
  initialPage: SearchPage | null;
  /** The server-side search failed: show the error and Try again. */
  initialError?: boolean;
  signedIn: boolean;
}) {
  const search = useSearch({
    initialQuery,
    initialPage,
    initialError,
  });
  const actions = useCardActions(search.save);
  const router = useRouter();
  const { results, status } = search;

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
        // Log in, then come back to this search (spec 09 #15).
        const back = discoverHref(results?.query ?? search.input);
        router.push(`/auth/login?next=${encodeURIComponent(back)}`);
        return;
      }
      setSheetId(animeId);
      setSheetOpen(true);
    },
    [signedIn, router, results?.query, search.input],
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

  const searchable = isSearchable(search.input);
  const firstLoad = status === "loading" && results === null;
  const stale = status === "loading" && results !== null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-title-l font-extrabold tracking-tight">
        Discover
      </h1>

      <SearchField
        value={search.input}
        autoFocus={initialQuery === ""}
        onChange={search.change}
        onSubmit={search.submit}
        onClear={search.clear}
      />

      {!searchable && results === null && status !== "error" ? (
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
          <NoResults query={results.query} onClear={search.clear} />
        ) : (
          <section
            aria-labelledby="results-heading"
            aria-busy={stale}
            className={cn(
              "flex flex-col gap-6 transition-opacity duration-(--duration-base)",
              stale && "opacity-50",
            )}
          >
            <h2
              id="results-heading"
              className="text-small font-semibold text-muted-foreground tabular-nums"
            >
              {resultsText(results.total, results.query)}
            </h2>
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

function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg bg-surface-1 px-6 py-10">
      <p className="font-display text-title-m font-extrabold break-words">
        No anime match &ldquo;{query.trim()}&rdquo;.
      </p>
      <p className="max-w-reading text-body text-muted-foreground">
        Check the spelling, or try another of its titles: the Japanese one or
        the English one.
      </p>
      <Button variant="secondary" onClick={onClear}>
        Clear search
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
