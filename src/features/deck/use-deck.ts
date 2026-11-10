"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  type TrackingResult,
  deckSkip,
  deckUndo,
} from "@/features/tracking/actions";
import type { TrackingState } from "@/features/tracking/schemas";
import { capture, reportRatedCount } from "@/lib/analytics/analytics";

import { loadDeckPage } from "./actions";
import {
  type UndoEntry,
  milestoneMessage,
  milestoneReached,
  popUndo,
  pushUndo,
  shouldPrefetch,
} from "./logic";
import type { DeckCard } from "./types";

export type Toast = { id: number; message: string; undo: boolean };
export type CardError = { animeId: number; message: string; retry: () => void };

type Done = { label: string; announce: string };
type SaveFn = (
  card: DeckCard,
  optimistic: TrackingState,
  call: () => Promise<TrackingResult>,
  done: Done,
) => Promise<boolean>;
type SkipFn = (card: DeckCard, via: "not_seen" | "passed") => Promise<boolean>;

const OFFLINE =
  "You're offline. Nothing was saved; try again when you're back online.";
const NETWORK = "That didn't reach us. Check your connection and try again.";
const GONE = "That anime is no longer in the catalog, so it was removed.";
const TOAST_MS = 5000;
// The latest undoable action, so its Undo survives a reload (spec 05).
const LAST_UNDO_KEY = "anikansou.deck.last-undo";

/** A server call that never throws: a network failure becomes an error. */
async function safely(
  call: () => Promise<TrackingResult>,
): Promise<TrackingResult> {
  try {
    return await call();
  } catch {
    return { ok: false, error: NETWORK };
  }
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function rememberLastUndo(entry: UndoEntry | null) {
  try {
    if (entry) {
      sessionStorage.setItem(
        LAST_UNDO_KEY,
        JSON.stringify({ ...entry, at: Date.now() }),
      );
    } else {
      sessionStorage.removeItem(LAST_UNDO_KEY);
    }
  } catch {
    // Storage blocked: the Undo just won't survive a reload.
  }
}

function readLastUndo(): UndoEntry | null {
  try {
    const raw = sessionStorage.getItem(LAST_UNDO_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<UndoEntry & { at: number }>;
    if (
      typeof value.animeId !== "number" ||
      typeof value.eventId !== "number" ||
      typeof value.label !== "string" ||
      typeof value.at !== "number" ||
      Date.now() - value.at > TOAST_MS
    ) {
      return null;
    }
    return {
      animeId: value.animeId,
      eventId: value.eventId,
      label: value.label,
    };
  } catch {
    return null;
  }
}

/**
 * The deck's shared state, used by both the touch and the web model
 * (decision 0009): the queue, saved state per card, optimistic saves with
 * rollback, the undo stack, prefetching, milestones and announcements.
 */
export function useDeck({
  initialCards,
  initialDone,
  initialRated,
}: {
  initialCards: DeckCard[];
  initialDone: boolean;
  initialRated: number;
}) {
  const [cards, setCards] = useState(initialCards);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(initialDone);
  // A ref, so the prefetch effect doesn't set state synchronously.
  const loadingMore = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [cardError, setCardError] = useState<CardError | null>(null);
  const [ratedTotal, setRatedTotal] = useState(initialRated);
  const [sessionRated, setSessionRated] = useState(0);
  const [milestone, setMilestone] = useState<{
    value: number;
    message: string;
  } | null>(null);
  // Web model: anime moved past untouched, and the event that recorded it.
  const passed = useRef(new Map<number, number>());
  // Anime acted on this session (web: they aren't "passed" when moving on).
  const touched = useRef(new Set<number>());
  // Saves still in flight per card, and the card's last state the server
  // confirmed. Saves run in order, so one finishing must not overwrite the
  // optimistic state of a newer one still in flight (e.g. Watched, then a
  // rating straight after: 0015); a failure goes back to what the server
  // last confirmed, not to a state that included other unsaved changes.
  const pendingSaves = useRef(new Map<number, number>());
  const confirmed = useRef(new Map<number, TrackingState>());
  const toastId = useRef(0);
  // Retries call the latest save/skip without the callbacks naming themselves.
  const saveRef = useRef<SaveFn | null>(null);
  const skipRef = useRef<SkipFn | null>(null);
  // The rated count, readable inside async saves without stale closures.
  const ratedRef = useRef(initialRated);
  // Every server call runs in order, one after another, so quick swipes and an
  // undo right after an action apply exactly as the user made them (spec 05
  // edge cases). The UI never waits for the queue.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Work not finished yet (queued calls, and an undo from its click), with a
  // way to wait until there is none; and calls not sent yet.
  const outstanding = useRef(0);
  const unsent = useRef(0);
  const idleWaiters = useRef<(() => void)[]>([]);
  const track = useCallback((delta: number) => {
    outstanding.current += delta;
    if (outstanding.current === 0) {
      idleWaiters.current.splice(0).forEach((resolve) => resolve());
    }
  }, []);
  const enqueue = useCallback(
    <T>(task: () => Promise<T>): Promise<T> => {
      track(1);
      unsent.current += 1;
      const start = () => {
        unsent.current -= 1;
        return task();
      };
      const run = queue.current.then(start, start);
      queue.current = run.catch(() => undefined).finally(() => track(-1));
      return run;
    },
    [track],
  );

  // Leaving with saves still running (spec 05 #15: nothing silently lost).
  // Leaving the deck in the app hides it (Cache Components keep it in an
  // <Activity>) and its queue keeps running; once the last save lands, the
  // page you moved to renders again with it (the Library takes it in when
  // idle). Closing or reloading the tab drops calls not sent yet, so until
  // they are sent the browser asks first, even while the deck is hidden.
  const router = useRouter();
  const onBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (unsent.current === 0) return;
    event.preventDefault();
    event.returnValue = "";
  }, []);
  const refreshQueued = useRef(false);
  const shown = useRef(false);
  useEffect(() => {
    shown.current = true;
    window.addEventListener("beforeunload", onBeforeUnload);
    const count = outstanding;
    const waiters = idleWaiters;
    const queuedRefresh = refreshQueued;
    const visible = shown;
    return () => {
      visible.current = false;
      if (count.current === 0) {
        window.removeEventListener("beforeunload", onBeforeUnload);
        return;
      }
      if (queuedRefresh.current) return;
      queuedRefresh.current = true;
      waiters.current.push(() => {
        queuedRefresh.current = false;
        // Back on the deck by now? Then it still needs the guard.
        if (!visible.current) {
          window.removeEventListener("beforeunload", onBeforeUnload);
        }
        router.refresh();
      });
    };
  }, [router, onBeforeUnload]);

  // The undo stack, also kept in a ref so undo reads it after the queue drains.
  const undoRef = useRef<UndoEntry[]>([]);
  const setUndo = useCallback((stack: UndoEntry[]) => {
    undoRef.current = stack;
    setUndoStack(stack);
    rememberLastUndo(stack.at(-1) ?? null);
  }, []);

  const current = cards[index] ?? null;

  const updateState = useCallback((animeId: number, state: TrackingState) => {
    setCards((list) =>
      list.map((card) =>
        card.animeId === animeId ? { ...card, state } : card,
      ),
    );
  }, []);

  const dropCard = useCallback((animeId: number) => {
    setCards((list) => list.filter((card) => card.animeId !== animeId));
  }, []);

  const showToast = useCallback((message: string, undo: boolean) => {
    toastId.current += 1;
    setToast({ id: toastId.current, message, undo });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);
  const clearMilestone = useCallback(() => setMilestone(null), []);

  // After a reload within the toast's lifetime, offer the latest Undo again.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const last = readLastUndo();
      if (!last) return;
      undoRef.current = [last];
      setUndoStack([last]);
      showToast(last.label, true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showToast]);

  // Prefetch: keep at least 5 cards ready, fetch when 3 are left (spec 05 #16).
  const remaining = cards.length - index - 1;
  useEffect(() => {
    if (!shouldPrefetch(remaining, done, loadingMore.current) || loadError) {
      return;
    }
    const last = cards.at(-1)?.animeId ?? null;
    loadingMore.current = true;
    void loadDeckPage(last)
      .then((page) => {
        if ("error" in page) {
          setLoadError(page.error);
          return;
        }
        setCards((list) => {
          const seen = new Set(list.map((c) => c.animeId));
          return [...list, ...page.cards.filter((c) => !seen.has(c.animeId))];
        });
        setDone(page.done);
      })
      .catch(() => setLoadError(NETWORK))
      .finally(() => {
        loadingMore.current = false;
      });
  }, [remaining, done, loadError, cards]);

  // Preload the next two posters.
  useEffect(() => {
    for (const card of cards.slice(index + 1, index + 3)) {
      const url = card.posterUrls[0];
      if (url) {
        const image = new Image();
        image.src = url;
      }
    }
  }, [cards, index]);

  const retryLoad = useCallback(() => setLoadError(null), []);

  /** Adds `delta` (±1) to the rated count, and reports a milestone. */
  const countRating = useCallback((delta: 1 | -1): string | null => {
    const before = ratedRef.current;
    const after = Math.max(0, before + delta);
    ratedRef.current = after;
    setRatedTotal(after);
    setSessionRated((n) => Math.max(0, n + delta));
    if (delta === 1) {
      reportRatedCount(before, after);
      const reached = milestoneReached(before, after);
      if (reached !== null) {
        const message = milestoneMessage(reached);
        setMilestone({ value: reached, message });
        return message;
      }
    }
    return null;
  }, []);

  /**
   * Saves one change: shows it at once, rolls back on failure (spec 05 #15).
   * Returns true when it saved.
   */
  const save = useCallback(
    async (
      card: DeckCard,
      optimistic: TrackingState,
      call: () => Promise<TrackingResult>,
      done: Done,
    ): Promise<boolean> => {
      if (isOffline()) {
        setCardError({
          animeId: card.animeId,
          message: OFFLINE,
          retry: () => setCardError(null),
        });
        setAnnouncement(OFFLINE);
        return false;
      }
      const id = card.animeId;
      const inFlight = pendingSaves.current.get(id) ?? 0;
      if (inFlight === 0) confirmed.current.set(id, card.state);
      pendingSaves.current.set(id, inFlight + 1);
      const settle = () => {
        const left = (pendingSaves.current.get(id) ?? 1) - 1;
        if (left === 0) pendingSaves.current.delete(id);
        else pendingSaves.current.set(id, left);
        return left;
      };
      setCardError(null);
      touched.current.add(card.animeId);
      updateState(card.animeId, optimistic);

      const result = await enqueue(() =>
        safely(async () => {
          // Acting on an anime passed earlier clears its "passed" record (0009).
          // Read inside the queue, so a pass still being saved is seen.
          const passEvent = passed.current.get(card.animeId);
          if (passEvent !== undefined) {
            passed.current.delete(card.animeId);
            await deckUndo(passEvent);
          }
          return call();
        }),
      );
      const left = settle();
      if (!result.ok) {
        if (result.gone) {
          // Retired by an import while it was in the queue (spec 05 edge case).
          dropCard(card.animeId);
          showToast(GONE, false);
          setAnnouncement(GONE);
          return true;
        }
        updateState(id, confirmed.current.get(id) ?? card.state);
        setCardError({
          animeId: card.animeId,
          message: result.error,
          retry: () => void saveRef.current?.(card, optimistic, call, done),
        });
        setAnnouncement(result.error);
        return false;
      }

      // Count ratings against what the server had before this save.
      const before = confirmed.current.get(id) ?? card.state;
      confirmed.current.set(id, result.state);
      if (left === 0) updateState(id, result.state);
      setUndo(
        pushUndo(undoRef.current, {
          animeId: card.animeId,
          eventId: result.eventId,
          label: done.label,
        }),
      );
      showToast(done.label, true);
      capture("deck_title_tracked", {
        status: result.state.status,
        rating: result.state.rating,
        liked: result.state.liked,
        watchlisted: result.state.watchlisted,
      });

      let milestoneLine: string | null = null;
      if (before.rating === null && result.state.rating !== null) {
        milestoneLine = countRating(1);
      } else if (before.rating !== null && result.state.rating === null) {
        countRating(-1);
      }
      setAnnouncement([done.announce, milestoneLine].filter(Boolean).join(" "));
      return true;
    },
    [countRating, dropCard, enqueue, setUndo, showToast, updateState],
  );

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  /** Records a skip ("Not seen" on touch, "passed" on the web). */
  const skip = useCallback(
    async (card: DeckCard, via: "not_seen" | "passed"): Promise<boolean> => {
      if (isOffline()) {
        if (via === "passed") return true; // Moving on never blocks.
        setCardError({
          animeId: card.animeId,
          message: OFFLINE,
          retry: () => setCardError(null),
        });
        setAnnouncement(OFFLINE);
        return false;
      }
      const result = await enqueue(() =>
        safely(() => deckSkip(card.animeId, via)),
      );
      if (!result.ok) {
        if (via === "passed") return true;
        if (result.gone) {
          dropCard(card.animeId);
          return true;
        }
        setCardError({
          animeId: card.animeId,
          message: result.error,
          retry: () => void skipRef.current?.(card, via),
        });
        setAnnouncement(result.error);
        return false;
      }
      capture("deck_title_skipped", { skip_method: via });
      if (via === "passed") {
        passed.current.set(card.animeId, result.eventId);
      } else {
        touched.current.add(card.animeId);
        setUndo(
          pushUndo(undoRef.current, {
            animeId: card.animeId,
            eventId: result.eventId,
            label: "Marked as not seen",
          }),
        );
        showToast("Marked as not seen", true);
      }
      return true;
    },
    [dropCard, enqueue, setUndo, showToast],
  );

  useEffect(() => {
    skipRef.current = skip;
  }, [skip]);

  /** Undoes the last saved change and returns the anime it touched. */
  const finishUndo = useCallback(
    async (entry: UndoEntry): Promise<number | null> => {
      const result = await enqueue(() => safely(() => deckUndo(entry.eventId)));
      if (!result.ok) {
        setUndo(pushUndo(undoRef.current, entry));
        showToast(result.error, false);
        setAnnouncement(result.error);
        return null;
      }
      const card = cards.find((c) => c.animeId === entry.animeId);
      if (card && card.state.rating !== null && result.state.rating === null) {
        countRating(-1);
      } else if (
        card &&
        card.state.rating === null &&
        result.state.rating !== null
      ) {
        countRating(1);
      }
      updateState(entry.animeId, result.state);
      const position = cards.findIndex((c) => c.animeId === entry.animeId);
      if (position >= 0) setIndex(position);
      showToast(`Undone: ${entry.label.toLowerCase()}`, false);
      setAnnouncement(
        `Undone. Back to ${card?.title ?? "the previous anime"}.`,
      );
      return entry.animeId;
    },
    [cards, countRating, enqueue, setUndo, showToast, updateState],
  );

  const undo = useCallback(async (): Promise<number | null> => {
    // Counted from the click, so leaving straight after waits for it too;
    // and not sent yet until its call is queued.
    track(1);
    unsent.current += 1;
    let handedOff = false;
    try {
      // Let saves already on their way finish, so undo takes the latest one.
      await queue.current;
      const { entry, rest } = popUndo(undoRef.current);
      unsent.current -= 1;
      handedOff = true;
      if (!entry) return null;
      setUndo(rest);
      return await finishUndo(entry);
    } finally {
      if (!handedOff) unsent.current -= 1;
      track(-1);
    }
  }, [finishUndo, setUndo, track]);

  const describe = useCallback((card: DeckCard): string => {
    const facts = [
      card.format,
      card.year,
      card.episodes ? `${card.episodes} episodes` : null,
    ]
      .filter(Boolean)
      .join(", ");
    return `${card.title}${facts ? `. ${facts}` : ""}.`;
  }, []);

  const goTo = useCallback(
    (next: number, { keepError = false }: { keepError?: boolean } = {}) => {
      const clamped = Math.max(0, Math.min(next, cards.length));
      setIndex(clamped);
      if (keepError) return;
      setCardError(null);
      const card = cards[clamped];
      if (card) setAnnouncement(describe(card));
    },
    [cards, describe],
  );

  /** Web: move forward, recording a pass for an untouched anime (0009). */
  const next = useCallback(() => {
    if (
      current &&
      !touched.current.has(current.animeId) &&
      !passed.current.has(current.animeId)
    ) {
      void skip(current, "passed");
    }
    goTo(index + 1);
  }, [current, goTo, index, skip]);

  const previous = useCallback(() => {
    if (index > 0) goTo(index - 1);
  }, [goTo, index]);

  return {
    cards,
    index,
    current,
    done,
    loadError,
    retryLoad,
    undoAvailable: undoStack.length > 0,
    toast,
    dismissToast,
    announcement,
    cardError,
    ratedTotal,
    sessionRated,
    milestone,
    clearMilestone,
    save,
    skip,
    undo,
    next,
    previous,
    /** Moves to the next card; the save that follows announces both. */
    advance: () => goTo(index + 1, { keepError: true }),
    /** The card after the current one, for "Rated … Next: …" announcements. */
    upcomingTitle: cards[index + 1]?.title ?? null,
    /** Brings an anime back to the top after a failed save, keeping the error. */
    show: (animeId: number) => {
      const position = cards.findIndex((c) => c.animeId === animeId);
      if (position >= 0) goTo(position, { keepError: true });
    },
    /** For results the hook doesn't announce itself (touch skips). */
    announce: setAnnouncement,
    isExhausted: index >= cards.length && done,
  };
}

export type DeckApi = ReturnType<typeof useDeck>;
