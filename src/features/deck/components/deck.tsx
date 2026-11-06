"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

import { type InputModel, inputModelFor } from "../logic";
import type { DeckCard } from "../types";
import { useDeck } from "../use-deck";
import {
  DeckEmpty,
  DeckProgress,
  DeckToast,
  MilestoneBurst,
} from "./deck-chrome";
import { DeckSkeleton } from "./deck-skeleton";
import { TouchDeck } from "./touch-deck";
import { WebDeck } from "./web-deck";

const COARSE = "(pointer: coarse)";
const FINE_HOVER = "(hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void) {
  const queries = [COARSE, FINE_HOVER].map((q) => window.matchMedia(q));
  queries.forEach((q) => q.addEventListener("change", onChange));
  return () =>
    queries.forEach((q) => q.removeEventListener("change", onChange));
}

/** Decision 0009: the model follows the input type and re-checks on change. */
function useInputModel(): InputModel | null {
  return useSyncExternalStore(
    subscribe,
    () =>
      inputModelFor({
        coarse: window.matchMedia(COARSE).matches,
        fineHover: window.matchMedia(FINE_HOVER).matches,
      }),
    // The server can't know the input type: show the skeleton until hydrated.
    () => null,
  );
}

/**
 * The swipe-to-rate deck (spec 05). Picks the touch or web model, and holds
 * what both share: progress, the toast, milestones and the live region.
 */
export function Deck({
  initialCards,
  initialDone,
  initialRated,
}: {
  initialCards: DeckCard[];
  initialDone: boolean;
  initialRated: number;
}) {
  const model = useInputModel();
  const deck = useDeck({ initialCards, initialDone, initialRated });
  // Adult posters stay blurred until revealed, for this session (0010).
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const reveal = useCallback(
    (animeId: number) => setRevealed((set) => new Set(set).add(animeId)),
    [],
  );
  const undo = useCallback(() => void deck.undo(), [deck]);

  const progress = (
    <DeckProgress
      sessionRated={deck.sessionRated}
      ratedTotal={deck.ratedTotal}
    />
  );

  let body;
  if (model === null) {
    body = <DeckSkeleton />;
  } else if (deck.current) {
    body =
      model === "touch" ? (
        <TouchDeck deck={deck} revealed={revealed} onReveal={reveal} />
      ) : (
        <WebDeck deck={deck} revealed={revealed} onReveal={reveal} />
      );
  } else if (deck.loadError) {
    body = (
      <div
        role="alert"
        className="mx-auto flex max-w-reading flex-col items-center gap-4 py-16 text-center"
      >
        <h2 className="font-display text-title-m font-extrabold">
          Couldn&apos;t load more anime
        </h2>
        <p className="text-muted-foreground">{deck.loadError}</p>
        <Button onClick={deck.retryLoad}>Try again</Button>
      </div>
    );
  } else if (deck.isExhausted) {
    body = <DeckEmpty sessionRated={deck.sessionRated} />;
  } else {
    body = <DeckSkeleton />;
  }

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-16">
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-title-l font-extrabold tracking-tight">
            Rate
          </h1>
          <div className="xl:hidden">{progress}</div>
        </div>
        {body}
      </div>
      {/* Right rail (0002), from 1280 px. */}
      <aside
        data-slot="right-rail"
        aria-label="Your progress"
        className="hidden xl:block"
      >
        <div className="sticky top-16 rounded-lg bg-surface-1 p-6">
          {progress}
        </div>
      </aside>

      <p aria-live="polite" className="sr-only">
        {deck.announcement}
      </p>
      <DeckToast
        toast={deck.toast}
        onUndo={undo}
        onDismiss={deck.dismissToast}
      />
      {deck.milestone ? (
        <MilestoneBurst
          key={deck.milestone.value}
          message={deck.milestone.message}
          onDone={deck.clearMilestone}
        />
      ) : null}
    </div>
  );
}
