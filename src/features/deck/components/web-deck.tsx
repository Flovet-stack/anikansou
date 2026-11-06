"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { HugeiconsChevronLeftIcon } from "@/components/ui/hugeicons-chevron-left";
import { HugeiconsChevronRightIcon } from "@/components/ui/hugeicons-chevron-right";
import {
  setLike,
  setRating,
  setStatus,
  setWatchlist,
} from "@/features/tracking/actions";
import { type WatchStatus, ratingToStars } from "@/features/tracking/schemas";
import { cn } from "@/lib/utils";

import {
  FLICK_VELOCITY,
  HORIZONTAL_COMMIT,
  controlsFor,
  ratingForKey,
} from "../logic";
import type { DeckCard } from "../types";
import type { DeckApi } from "../use-deck";
import { CardDetails } from "./card-details";
import { DeckPoster } from "./deck-poster";
import { RatingStars } from "./rating-stars";
import { STATUS_META, StatusPicker } from "./status-picker";
import { ToggleAction } from "./toggle-action";

const NEXT_HINT_KEY = "anikansou.deck.web-next-hint";

/**
 * The web model (decision 0009): swiping, the arrows and ←/→ only move
 * between anime. Every action is a one-click control that saves at once;
 * nothing auto-advances.
 */
export function WebDeck({
  deck,
  revealed,
  onReveal,
}: {
  deck: DeckApi;
  revealed: Set<number>;
  onReveal: (animeId: number) => void;
}) {
  const card = deck.current;
  const reduceMotion = useReducedMotion();
  // Pointer navigation slides; keyboard navigation doesn't animate (0009).
  const [slideFrom, setSlideFrom] = useState(0);
  const [showNextHint, setShowNextHint] = useState(false);

  const goNext = useCallback(
    (fromPointer: boolean) => {
      setSlideFrom(fromPointer && !reduceMotion ? 1 : 0);
      setShowNextHint(false);
      deck.next();
    },
    [deck, reduceMotion],
  );
  const goPrevious = useCallback(
    (fromPointer: boolean) => {
      setSlideFrom(fromPointer && !reduceMotion ? -1 : 0);
      deck.previous();
    },
    [deck, reduceMotion],
  );

  const actions = useActions(deck, card, () => {
    try {
      if (!localStorage.getItem(NEXT_HINT_KEY)) {
        localStorage.setItem(NEXT_HINT_KEY, "1");
        setShowNextHint(true);
      }
    } catch {
      // Storage blocked: skip the hint.
    }
  });

  // Keys (0009): ←/→ or J/K move; 1–9, 0 rate; Backspace clears the rating;
  // W watched; L like; A watchlist; Ctrl/Cmd+Z undo.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void deck.undo();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      // J next, K previous, as in feed readers.
      if (key === "ArrowRight" || key === "j")
        return void (event.preventDefault(), goNext(false));
      if (key === "ArrowLeft" || key === "k")
        return void (event.preventDefault(), goPrevious(false));
      if (!card) return;
      if (key === "l") return void actions.toggleLike();
      if (key === "a") return void actions.toggleWatchlist();
      if (card.isUpcoming) return;
      const rating = ratingForKey(key);
      if (rating !== null) return void actions.rate(rating);
      if (key === "Backspace") return void actions.rate(null);
      if (key === "w") return void actions.status("watched");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, card, deck, goNext, goPrevious]);

  if (!card) return null;
  const headingId = `deck-title-${card.animeId}`;

  return (
    <section
      aria-labelledby={headingId}
      className="grid items-start gap-10 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-12"
    >
      <div className="relative">
        <motion.div
          key={card.animeId}
          initial={slideFrom === 0 ? false : { opacity: 0, x: slideFrom * 48 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          drag="x"
          dragSnapToOrigin
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            const width = 360;
            const far = Math.abs(info.offset.x) >= width * HORIZONTAL_COMMIT;
            const fast = Math.abs(info.velocity.x) >= FLICK_VELOCITY;
            if (!far && !fast) return;
            if (info.offset.x < 0) goNext(true);
            else goPrevious(true);
          }}
          className="cursor-grab touch-pan-y active:cursor-grabbing"
        >
          <DeckPoster
            card={card}
            revealed={revealed.has(card.animeId)}
            onReveal={() => onReveal(card.animeId)}
          />
        </motion.div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="icon"
            aria-label="Previous anime"
            aria-keyshortcuts="ArrowLeft"
            // aria-disabled keeps focus on the button at the first card.
            aria-disabled={deck.index === 0}
            onClick={() => {
              if (deck.index > 0) goPrevious(true);
            }}
            className={cn(deck.index === 0 && "opacity-50")}
          >
            <HugeiconsChevronLeftIcon size={22} aria-hidden />
          </Button>
          <span className="text-small text-muted-foreground tabular-nums">
            {deck.index + 1} this session
          </span>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Next anime"
            aria-keyshortcuts="ArrowRight"
            onClick={() => goNext(true)}
            // One pulse, then a steady ring until clicked (0009).
            className={cn(
              showNextHint &&
                "animate-[pulse_1s_ease-in-out_1] ring-2 ring-kohaku motion-reduce:animate-none",
            )}
          >
            <HugeiconsChevronRightIcon size={22} aria-hidden />
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-10">
        <CardDetails card={card} headingId={headingId} />

        <div className="flex flex-col gap-8 rounded-lg bg-surface-1 p-6 md:p-8">
          {!controlsFor(card).rating ? (
            <p className="text-body text-muted-foreground">
              Not aired yet. You can like it or add it to your watchlist.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <h3 className="text-small font-semibold text-muted-foreground">
                  Rating
                </h3>
                <RatingStars
                  value={card.state.rating}
                  onChange={(rating) => void actions.rate(rating)}
                  clearable
                />
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-small font-semibold text-muted-foreground">
                  Status
                </h3>
                <StatusPicker
                  value={card.state.status}
                  onChange={(status) => void actions.status(status)}
                />
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-3">
            <ToggleAction
              kind="like"
              on={card.state.liked}
              onToggle={() => void actions.toggleLike()}
              keyHint="L"
            />
            <ToggleAction
              kind="watchlist"
              on={card.state.watchlisted}
              onToggle={() => void actions.toggleWatchlist()}
              keyHint="A"
            />
          </div>
          {deck.cardError?.animeId === card.animeId ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 text-small text-danger"
            >
              <span>{deck.cardError.message}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={deck.cardError.retry}
              >
                Try again
              </Button>
            </div>
          ) : null}
        </div>
        <p className="hidden text-caption text-text-subtle md:block">
          Keys: ← → move · 1–9 and 0 rate · W watched · L like · A watchlist ·
          Ctrl+Z undo
        </p>
      </div>
    </section>
  );
}

/** The panel's saves, shared by buttons and keys. */
function useActions(
  deck: DeckApi,
  card: DeckCard | null,
  onFirstAction: () => void,
) {
  return {
    rate: async (rating: number | null) => {
      if (!card || card.isUpcoming) return;
      const optimistic = {
        ...card.state,
        rating,
        status:
          rating !== null && card.state.status === null
            ? ("watched" as const)
            : card.state.status,
      };
      const saved = await deck.save(
        card,
        optimistic,
        () => setRating(card.animeId, rating),
        {
          label:
            rating === null
              ? "Rating cleared"
              : `Rated ${ratingToStars(rating)} stars`,
          announce:
            rating === null
              ? `Rating cleared for ${card.title}.`
              : `Rated ${card.title} ${ratingToStars(rating)} stars.`,
        },
      );
      if (saved) onFirstAction();
    },
    status: async (status: WatchStatus | null) => {
      if (!card || card.isUpcoming) return;
      const label =
        status === null ? "Status cleared" : STATUS_META[status].label;
      const saved = await deck.save(
        card,
        { ...card.state, status },
        () => setStatus(card.animeId, status),
        { label, announce: `${label}: ${card.title}.` },
      );
      if (saved) onFirstAction();
    },
    toggleLike: async () => {
      if (!card) return;
      const liked = !card.state.liked;
      const saved = await deck.save(
        card,
        { ...card.state, liked },
        () => setLike(card.animeId, liked),
        {
          label: liked ? "Liked" : "Like removed",
          announce: liked
            ? `Liked ${card.title}.`
            : `Removed like from ${card.title}.`,
        },
      );
      if (saved) onFirstAction();
    },
    toggleWatchlist: async () => {
      if (!card) return;
      const watchlisted = !card.state.watchlisted;
      const saved = await deck.save(
        card,
        { ...card.state, watchlisted },
        () => setWatchlist(card.animeId, watchlisted),
        {
          label: watchlisted ? "Added to watchlist" : "Removed from watchlist",
          announce: watchlisted
            ? `Added ${card.title} to your watchlist.`
            : `Removed ${card.title} from your watchlist.`,
        },
      );
      if (saved) onFirstAction();
    },
  };
}
