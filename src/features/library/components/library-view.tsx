"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ActionToast } from "@/components/feedback/action-toast";
import { Button } from "@/components/ui/button";

import { useCardActions } from "../card-actions";
import { shelfContains } from "../logic";
import type {
  LibraryCard,
  LibraryCursor,
  Shelf,
  ShelfCounts,
  Sort,
} from "../types";
import { useLibrary } from "../use-library";
import { EditSheet } from "./edit-sheet";
import { LibraryEmpty } from "./library-empty";
import { ShelfTabs, SortMenu } from "./shelf-controls";
import { TitleCard } from "./title-card";

/**
 * The Library (spec 07, decision 0016): shelf tabs with counts, the sort
 * menu, the 0006 grid with quick actions, "Show more", the edit sheet and
 * the Undo toast.
 */
export function LibraryView({
  shelf,
  sort,
  sortInUrl,
  revision,
  initialCards,
  initialNext,
  initialCounts,
}: {
  shelf: Shelf;
  sort: Sort;
  /** False when the URL had no `?sort=`: the remembered sort then applies. */
  sortInUrl: boolean;
  /** Changes with each server render; see useLibrary. */
  revision: string;
  initialCards: LibraryCard[];
  initialNext: LibraryCursor | null;
  initialCounts: ShelfCounts;
}) {
  const library = useLibrary({
    shelf,
    sort,
    revision,
    initialCards,
    initialNext,
    initialCounts,
  });
  const actions = useCardActions(library.save);

  // The edit sheet: which title, and whether it's open (kept while closing).
  const [sheetId, setSheetId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetCard =
    library.cards.find((card) => card.animeId === sheetId) ?? null;
  const cardButtons = useRef(new Map<number, HTMLButtonElement>());
  const heading = useRef<HTMLHeadingElement>(null);
  const { hold, release, undo } = library;

  const openSheet = useCallback(
    (animeId: number) => {
      hold(animeId);
      setSheetId(animeId);
      setSheetOpen(true);
    },
    [hold],
  );
  const closeSheet = useCallback(() => {
    release();
    setSheetOpen(false);
  }, [release]);

  // "Show more" moves focus to the first new card (spec 07 #9); a card that
  // leaves the grid while focused hands focus to its neighbour.
  const { focusRequest } = library;
  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.target === "heading") heading.current?.focus();
    else cardButtons.current.get(focusRequest.target)?.focus();
  }, [focusRequest]);

  // Ctrl/Cmd+Z undoes the last change, as in the deck: the toast is far down
  // the tab order and closes after 5 s.
  useEffect(() => {
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
  }, [undo]);

  const total = library.counts[shelf];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1
          ref={heading}
          tabIndex={-1}
          className="font-display text-title-l font-extrabold tracking-tight focus:outline-none"
        >
          Library
        </h1>
        <SortMenu shelf={shelf} sort={sort} sortInUrl={sortInUrl} />
      </div>

      <ShelfTabs shelf={shelf} sort={sort} counts={library.counts} />

      {library.cards.length === 0 && !library.hasMore ? (
        <LibraryEmpty shelf={shelf} />
      ) : (
        <>
          {library.cards.length === 0 ? null : (
            <ul
              aria-label={`${total} ${total === 1 ? "title" : "titles"}`}
              className="grid grid-cols-2 gap-x-4 gap-y-6 min-[600px]:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] min-[600px]:gap-x-8 min-[600px]:gap-y-10"
            >
              {library.cards.map((card) => (
                <li key={card.animeId} data-card-item={card.animeId}>
                  <TitleCard
                    ref={(element) => {
                      if (element)
                        cardButtons.current.set(card.animeId, element);
                      else cardButtons.current.delete(card.animeId);
                    }}
                    card={card}
                    leaving={!shelfContains(shelf, card.state)}
                    onOpen={() => openSheet(card.animeId)}
                    onToggleWatched={() => actions.toggleWatched(card)}
                    onToggleLike={() => actions.toggleLike(card)}
                    onToggleWatchlist={() => actions.toggleWatchlist(card)}
                  />
                </li>
              ))}
            </ul>
          )}
          {library.hasMore || library.loadError ? (
            <div className="flex flex-col items-center gap-3">
              {library.loadError ? (
                <p role="alert" className="text-small text-danger">
                  {library.loadError}
                </p>
              ) : null}
              <Button
                variant="secondary"
                onClick={() => void library.loadMore()}
                disabled={library.loadingMore}
              >
                {library.loadingMore
                  ? "Loading…"
                  : library.loadError
                    ? "Try again"
                    : "Show more"}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <EditSheet
        open={sheetOpen}
        card={sheetCard}
        onClose={closeSheet}
        returnFocus={() =>
          sheetId === null ? null : (cardButtons.current.get(sheetId) ?? null)
        }
        onStatus={(status) => sheetCard && actions.setStatus(sheetCard, status)}
        onRate={(rating) => sheetCard && actions.rate(sheetCard, rating)}
        onToggleLike={() => sheetCard && actions.toggleLike(sheetCard)}
        onToggleWatchlist={() =>
          sheetCard && actions.toggleWatchlist(sheetCard)
        }
        onRemove={() => {
          if (!sheetCard) return;
          closeSheet();
          actions.remove(sheetCard);
        }}
      />

      <p aria-live="polite" className="sr-only">
        {library.announcement}
      </p>
      <ActionToast toast={library.toast} onDismiss={library.dismissToast} />
    </div>
  );
}
