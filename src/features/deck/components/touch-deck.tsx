"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { HugeiconsBookmark01Icon } from "@/components/ui/hugeicons-bookmark-01";
import { HugeiconsCircleCheckIcon } from "@/components/ui/hugeicons-circle-check";
import { HugeiconsEyeOffIcon } from "@/components/ui/hugeicons-eye-off";
import { HugeiconsUndoIcon } from "@/components/ui/hugeicons-undo";
import { deckSeen, setLike, setWatchlist } from "@/features/tracking/actions";
import { type WatchStatus, ratingToStars } from "@/features/tracking/schemas";
import { cn } from "@/lib/utils";

import {
  type SwipeDirection,
  classifySwipe,
  controlsFor,
  ratingForKey,
} from "../logic";
import type { DeckApi } from "../use-deck";
import { CardDetails } from "./card-details";
import { DeckPoster } from "./deck-poster";
import { RatingStars } from "./rating-stars";
import { StatusPicker } from "./status-picker";
import { ToggleAction } from "./toggle-action";

const HINT_KEY = "anikansou.deck.touch-hint";

/**
 * The touch model (decision 0009): swipe right "Seen it" (then rate in one
 * tap), left "Not seen", up "Want to watch". Every gesture also has a button
 * and a key (WCAG 2.5.1, 2.5.7).
 */
export function TouchDeck({
  deck,
  revealed,
  onReveal,
}: {
  deck: DeckApi;
  revealed: Set<number>;
  onReveal: (animeId: number) => void;
}) {
  const card = deck.current;
  const nextCard = deck.cards[deck.index + 1] ?? null;
  const reduceMotion = useReducedMotion();
  // Per-card UI state, keyed by anime id so a new top card starts fresh.
  const [rateFor, setRateFor] = useState<number | null>(null);
  const [statusFor, setStatusFor] = useState<{
    animeId: number;
    status: WatchStatus;
  } | null>(null);
  const [noticeFor, setNoticeFor] = useState<number | null>(null);
  const animeId = card?.animeId ?? null;
  const step: "deck" | "rate" =
    rateFor !== null && rateFor === animeId ? "rate" : "deck";
  const status: WatchStatus =
    statusFor && statusFor.animeId === animeId ? statusFor.status : "watched";
  const notice =
    noticeFor !== null && noticeFor === animeId ? "Not aired yet" : null;
  const setStep = useCallback(
    (next: "deck" | "rate") => setRateFor(next === "rate" ? animeId : null),
    [animeId],
  );
  const setStatusChoice = useCallback(
    (next: WatchStatus) => {
      if (animeId !== null) setStatusFor({ animeId, status: next });
    },
    [animeId],
  );
  const cardRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const rateRef = useRef<HTMLDivElement>(null);
  // Where focus goes after the next render: the first star when the rating
  // step opens, back to the actions when it closes (so it never drops to the
  // page). Set by the handlers, applied in an effect.
  const focusNext = useRef<"stars" | "actions" | null>(null);
  const interacted = useRef(false);
  const [hinting, setHinting] = useState(false);
  const next = deck.upcomingTitle;
  const nextLine = next ? ` Next: ${next}.` : "";

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], reduceMotion ? [0, 0] : [-8, 8]);
  const seenOpacity = useTransform(x, [0, 110], [0, 1]);
  const notSeenOpacity = useTransform(x, [-110, 0], [1, 0]);
  const watchlistOpacity = useTransform(y, [-120, 0], [1, 0]);

  // A new top card starts centred.
  useEffect(() => {
    x.set(0);
    y.set(0);
  }, [animeId, x, y]);

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    const container = target === "stars" ? rateRef.current : actionsRef.current;
    // Back to the actions means a new card: show it from the top, then move
    // focus without scrolling the page away from it.
    if (target === "actions") window.scrollTo({ top: 0 });
    container
      ?.querySelector<HTMLButtonElement>(
        target === "stars" ? "button" : "[data-action=seen], button",
      )
      ?.focus({ preventScroll: target === "actions" });
  }, [animeId, step]);

  // First-run hint (0009): on a first visit, nudge the card right and left
  // and highlight the buttons; again after 5 s if nothing was swiped yet.
  useEffect(() => {
    if (!card) return;
    let seen = true;
    try {
      seen = localStorage.getItem(HINT_KEY) === "1";
      if (!seen) localStorage.setItem(HINT_KEY, "1");
    } catch {
      // Storage blocked: skip the hint.
    }
    if (seen) return;
    const nudge = () => {
      setHinting(true);
      const settle = () => setHinting(false);
      if (reduceMotion) {
        window.setTimeout(settle, 1500);
        return;
      }
      void animate(x, [0, 36, -36, 0], {
        duration: 1.2,
        ease: "easeInOut",
      }).then(settle);
    };
    const first = window.setTimeout(nudge, 900);
    const again = window.setTimeout(() => {
      if (!interacted.current) nudge();
    }, 5900);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(again);
    };
    // Only on the first card shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Throws the card out (pointer only), then moves on. */
  const flyOut = useCallback(
    async (direction: SwipeDirection, animated: boolean) => {
      if (!animated || reduceMotion) return;
      const width = cardRef.current?.offsetWidth ?? 360;
      const height = cardRef.current?.offsetHeight ?? 540;
      const transition = { duration: 0.22, ease: [0.2, 0, 0, 1] as const };
      if (direction === "up") {
        await animate(y, -height * 1.4, transition);
      } else {
        await animate(
          x,
          (direction === "right" ? 1 : -1) * width * 1.6,
          transition,
        );
      }
    },
    [reduceMotion, x, y],
  );

  const notSeen = useCallback(
    async (animated: boolean) => {
      if (!card) return;
      interacted.current = true;
      await flyOut("left", animated);
      deck.advance();
      const ok = await deck.skip(card, "not_seen");
      if (!ok) deck.show(card.animeId);
      else deck.announce(`Marked ${card.title} as not seen.${nextLine}`);
    },
    [card, deck, flyOut, nextLine],
  );

  const wantToWatch = useCallback(
    async (animated: boolean) => {
      if (!card) return;
      interacted.current = true;
      await flyOut("up", animated);
      deck.advance();
      const ok = await deck.save(
        card,
        { ...card.state, watchlisted: true },
        () => setWatchlist(card.animeId, true),
        {
          label: "Added to watchlist",
          announce: `Added ${card.title} to your watchlist.${nextLine}`,
        },
      );
      if (!ok) deck.show(card.animeId);
    },
    [card, deck, flyOut, nextLine],
  );

  const seenIt = useCallback(() => {
    if (!card) return;
    interacted.current = true;
    if (card.isUpcoming) {
      setNoticeFor(card.animeId);
      void animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
      return;
    }
    void animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
    focusNext.current = "stars";
    setStep("rate");
  }, [card, setStep, x]);

  /** Saves "Seen it" with the chosen status and rating, then moves on. */
  const saveSeen = useCallback(
    async (rating: number | null) => {
      if (!card) return;
      focusNext.current = "actions";
      deck.advance();
      const ok = await deck.save(
        card,
        { ...card.state, status, rating },
        () => deckSeen(card.animeId, status, rating),
        {
          label:
            rating === null ? "Saved" : `Rated ${ratingToStars(rating)} stars`,
          announce:
            rating === null
              ? `Saved ${card.title}.${nextLine}`
              : `Rated ${card.title} ${ratingToStars(rating)} stars.${nextLine}`,
        },
      );
      if (!ok) deck.show(card.animeId);
    },
    [card, deck, nextLine, status],
  );

  const toggleLike = useCallback(() => {
    if (!card) return;
    const liked = !card.state.liked;
    void deck.save(
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
  }, [card, deck]);

  // Keys: ← not seen, → seen it, ↑ want to watch, L like, Z undo; in the
  // rating step 1–9 and 0 rate, Enter saves without a rating, Esc goes back.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const key = event.key;
      if (key.toLowerCase() === "z" && !event.altKey) {
        event.preventDefault();
        void deck.undo();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || !card) return;
      if (step === "rate") {
        const rating = ratingForKey(key);
        if (rating !== null) return void saveSeen(rating);
        if (key === "Enter")
          return void (event.preventDefault(), saveSeen(null));
        if (key === "Escape") {
          focusNext.current = "actions";
          return void setStep("deck");
        }
        return;
      }
      if (key === "ArrowLeft")
        return void (event.preventDefault(), notSeen(false));
      if (key === "ArrowRight") return void (event.preventDefault(), seenIt());
      if (key === "ArrowUp")
        return void (event.preventDefault(), wantToWatch(false));
      if (key === "l") return void toggleLike();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    card,
    deck,
    notSeen,
    saveSeen,
    seenIt,
    setStep,
    step,
    toggleLike,
    wantToWatch,
  ]);

  if (!card) return null;
  const headingId = `deck-title-${card.animeId}`;

  return (
    <section
      aria-labelledby={headingId}
      className="mx-auto flex w-full max-w-[400px] flex-col gap-6"
    >
      <div
        className="relative mx-auto w-full max-w-[min(100%,calc((100dvh-21rem)*2/3))]"
        ref={cardRef}
      >
        {nextCard ? (
          <div aria-hidden className="absolute inset-0 scale-[0.96] opacity-60">
            <DeckPoster
              card={nextCard}
              revealed={revealed.has(nextCard.animeId)}
              onReveal={() => {}}
            />
          </div>
        ) : null}
        <motion.div
          key={card.animeId}
          initial={
            reduceMotion ? { opacity: 0 } : { scale: 0.96, opacity: 0.6 }
          }
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            duration: reduceMotion ? 0.12 : 0.2,
            ease: [0.2, 0, 0, 1],
          }}
          style={{ x, y, rotate }}
          drag={step === "deck"}
          dragSnapToOrigin
          dragElastic={0.6}
          onDragEnd={(_, info) => {
            const box = cardRef.current;
            const direction = classifySwipe({
              dx: info.offset.x,
              dy: info.offset.y,
              vx: info.velocity.x,
              vy: info.velocity.y,
              width: box?.offsetWidth ?? 360,
              height: box?.offsetHeight ?? 540,
            });
            if (direction === "left") void notSeen(true);
            else if (direction === "up") void wantToWatch(true);
            else if (direction === "right") seenIt();
          }}
          className="relative touch-none"
        >
          <DeckPoster
            card={card}
            revealed={revealed.has(card.animeId)}
            onReveal={() => onReveal(card.animeId)}
          />
          {/* Drag labels in the state colours (0005), fading in with distance. */}
          <motion.span
            aria-hidden
            style={{ opacity: seenOpacity }}
            className={
              card.isUpcoming
                ? "pointer-events-none absolute top-6 left-4 -rotate-6 rounded-md border-2 border-border bg-black/70 px-3 py-1 font-display text-title-s font-extrabold text-muted-foreground"
                : "pointer-events-none absolute top-6 left-4 -rotate-6 rounded-md border-2 border-state-watched bg-black/60 px-3 py-1 font-display text-title-s font-extrabold text-state-watched"
            }
          >
            {card.isUpcoming ? "Not aired yet" : "Seen it"}
          </motion.span>
          <motion.span
            aria-hidden
            style={{ opacity: notSeenOpacity }}
            className="pointer-events-none absolute top-6 right-4 rotate-6 rounded-md border-2 border-state-dropped bg-black/60 px-3 py-1 font-display text-title-s font-extrabold text-state-dropped"
          >
            Not seen
          </motion.span>
          <motion.span
            aria-hidden
            style={{ opacity: watchlistOpacity }}
            className="pointer-events-none absolute inset-x-0 bottom-8 mx-auto w-fit rounded-md border-2 border-state-watchlist bg-black/60 px-3 py-1 font-display text-title-s font-extrabold text-state-watchlist"
          >
            Watchlist
          </motion.span>
        </motion.div>
      </div>

      {step === "rate" ? (
        <div
          role="group"
          aria-label={`Rate ${card.title}`}
          ref={rateRef}
          className="flex flex-col gap-6 rounded-lg bg-surface-1 p-5"
        >
          <p className="text-small font-semibold text-muted-foreground">
            Tap a rating to save and move on
          </p>
          <RatingStars
            value={null}
            onChange={(rating) => rating !== null && void saveSeen(rating)}
            size="lg"
          />
          <StatusPicker
            value={status}
            onChange={(next) => next && setStatusChoice(next)}
            clearable={false}
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => void saveSeen(null)}>
              Save without rating
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                focusNext.current = "actions";
                setStep("deck");
              }}
            >
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div ref={actionsRef} className="grid grid-cols-3 gap-3">
          <ActionButton
            label="Not seen"
            highlight={hinting}
            keyHint="ArrowLeft"
            className="text-state-dropped"
            onClick={() => void notSeen(false)}
            icon={<HugeiconsEyeOffIcon size={24} aria-hidden />}
          />
          <ActionButton
            label="Want to watch"
            highlight={hinting}
            keyHint="ArrowUp"
            className="text-state-watchlist"
            onClick={() => void wantToWatch(false)}
            icon={<HugeiconsBookmark01Icon size={24} aria-hidden />}
          />
          {!controlsFor(card).seenIt ? (
            <p className="flex items-center justify-center rounded-lg bg-surface-1 px-2 text-center text-caption text-text-subtle">
              Not aired yet
            </p>
          ) : (
            <ActionButton
              label="Seen it"
              action="seen"
              highlight={hinting}
              keyHint="ArrowRight"
              className="text-state-watched"
              onClick={seenIt}
              icon={<HugeiconsCircleCheckIcon size={24} aria-hidden />}
            />
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <CardDetails card={card} headingId={headingId} />
        <ToggleAction
          kind="like"
          on={card.state.liked}
          onToggle={toggleLike}
          compact
          keyHint="L"
        />
      </div>

      {notice ? (
        <p role="status" className="text-small text-muted-foreground">
          {notice}: you can add it to your watchlist instead.
        </p>
      ) : null}

      {deck.cardError?.animeId === card.animeId ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 text-small text-danger"
        >
          <span>{deck.cardError.message}</span>
          <Button variant="secondary" size="sm" onClick={deck.cardError.retry}>
            Try again
          </Button>
        </div>
      ) : null}

      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          disabled={!deck.undoAvailable}
          onClick={() => void deck.undo()}
          aria-keyshortcuts="Z"
        >
          <HugeiconsUndoIcon size={18} aria-hidden />
          Undo
        </Button>
      </div>
    </section>
  );
}

function ActionButton({
  label,
  icon,
  keyHint,
  className,
  highlight = false,
  action,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  keyHint: string;
  className?: string;
  highlight?: boolean;
  action?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-keyshortcuts={keyHint}
      data-action={action}
      className={cn(
        highlight && "ring-2 ring-kohaku",
        "flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg bg-surface-2 px-2 text-small font-semibold transition-transform duration-(--duration-fast) active:scale-[0.97]",
        className,
      )}
    >
      {icon}
      <span className="text-foreground">{label}</span>
    </button>
  );
}
