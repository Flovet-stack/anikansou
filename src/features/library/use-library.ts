"use client";

import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ActionToastProps } from "@/components/feedback/action-toast";
import { type TrackingResult, deckUndo } from "@/features/tracking/actions";
import type { TrackingState } from "@/features/tracking/schemas";
import { env } from "@/env";

import { loadLibraryPage } from "./actions";
import { pruneLeft, shiftCounts } from "./logic";
import type {
  LibraryCard,
  LibraryCursor,
  Shelf,
  ShelfCounts,
  Sort,
} from "./types";

const NETWORK = "That didn't reach us. Check your connection and try again.";
const OFFLINE =
  "You're offline. Nothing was saved; try again when you're back online.";
const GONE = "That anime is no longer in the catalog, so it was removed.";

/** A server call that never throws: a network failure becomes an error. */
export async function safely(
  call: () => Promise<TrackingResult>,
): Promise<TrackingResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, error: OFFLINE };
  }
  try {
    return await call();
  } catch {
    return { ok: false, error: NETWORK };
  }
}

type Toast = ActionToastProps & { animeId: number | null };
type Undo = { eventId: number; animeId: number; label: string };

export type SaveIntent = {
  /** The state to show straight away. */
  optimistic: TrackingState;
  call: () => Promise<TrackingResult>;
  /** Toast and announcement on success, e.g. "Moved to Dropped". */
  label: string;
};

/**
 * The Library grid's state (spec 07): the cards loaded so far, shelf counts,
 * optimistic saves with rollback, the Undo toast, "Show more" and the live
 * region. Cards that leave the shelf stay, dimmed, until their toast closes.
 */
export function useLibrary({
  shelf,
  sort,
  revision,
  initialCards,
  initialNext,
  initialCounts,
}: {
  shelf: Shelf;
  sort: Sort;
  /** Changes when the server renders the page again (a refresh). */
  revision: string;
  initialCards: LibraryCard[];
  initialNext: LibraryCursor | null;
  initialCounts: ShelfCounts;
}) {
  const [cards, setCards] = useState(initialCards);
  const [counts, setCounts] = useState(initialCounts);
  const [next, setNext] = useState(initialNext);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [announcement, setAnnouncement] = useState("");
  /**
   * Where focus should go next: the first card of a new page, or, when the
   * focused card leaves the grid, its neighbour (or the heading if none is
   * left). `n` makes repeat requests for the same target count.
   */
  const [focusRequest, setFocusRequest] = useState<{
    target: number | "heading";
    n: number;
  } | null>(null);
  const requestFocus = useCallback((target: number | "heading") => {
    setFocusRequest((last) => ({ target, n: (last?.n ?? 0) + 1 }));
  }, []);

  // Fresh server data from a refresh (e.g. the deck's last saves landed after
  // this page opened: spec 05 #15). Taken in only when nothing is going on
  // here (no save in flight, no toast, no open sheet), so it never wipes an
  // edit, an Undo or the sheet.
  type Incoming = {
    cards: LibraryCard[];
    next: LibraryCursor | null;
    counts: ShelfCounts;
  };
  const [seenRevision, setSeenRevision] = useState(revision);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  if (revision !== seenRevision) {
    setSeenRevision(revision);
    setIncoming({
      cards: initialCards,
      next: initialNext,
      counts: initialCounts,
    });
  }
  const incomingRef = useRef<Incoming | null>(null);

  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);
  const loadingRef = useRef(false);
  /** Titles added by "Show more", kept when fresh page-1 data comes in. */
  const extraIds = useRef(new Set<number>());
  // Edits made here since the snapshot we'd take in was asked for. A
  // snapshot asked for before an edit may predate it, so it's refreshed
  // again instead of shown.
  const router = useRouter();
  const edits = useRef(0);
  const editsAtRequest = useRef(0);

  /** When the focused card leaves the grid, focus its nearest neighbour. */
  const keepFocus = useCallback(
    (before: LibraryCard[], after: LibraryCard[]) => {
      const focused =
        typeof document === "undefined"
          ? null
          : document.activeElement?.closest<HTMLElement>("[data-card-item]");
      const focusedId = focused ? Number(focused.dataset.cardItem) : null;
      if (focusedId === null) return;
      const kept = new Set(after.map((c) => c.animeId));
      if (kept.has(focusedId)) return;
      const at = before.findIndex((c) => c.animeId === focusedId);
      const later = before.slice(at + 1).find((c) => kept.has(c.animeId));
      const earlier = before
        .slice(0, Math.max(at, 0))
        .reverse()
        .find((c) => kept.has(c.animeId));
      requestFocus((later ?? earlier)?.animeId ?? "heading");
    },
    [requestFocus],
  );
  const toastId = useRef(0);
  const undoRef = useRef<Undo | null>(null);
  const toastRef = useRef<Toast | null>(null);
  /** The title open in the edit sheet: never pruned while it's open. */
  const heldRef = useRef<number | null>(null);
  // Saves in flight per title, and the last state the server confirmed, so
  // an older reply never overwrites a newer choice (as in the deck).
  const pending = useRef(new Map<number, number>());
  const confirmed = useRef(new Map<number, TrackingState>());

  /** Sets a title's state and moves the counts with it. */
  const applyState = useCallback((animeId: number, state: TrackingState) => {
    const current = cardsRef.current.find((card) => card.animeId === animeId);
    if (!current) return;
    const before = current.state;
    const updated = cardsRef.current.map((card) =>
      card.animeId === animeId ? { ...card, state } : card,
    );
    cardsRef.current = updated;
    setCards(updated);
    setCounts((counts) => shiftCounts(counts, before, state));
  }, []);

  /** Drops titles that left the shelf, except `keep` and any still saving. */
  const prune = useCallback(
    (keep: number | null) => {
      const held = new Set<number>(keep === null ? [] : [keep]);
      if (heldRef.current !== null) held.add(heldRef.current);
      for (const [id, count] of pending.current) if (count > 0) held.add(id);
      const before = cardsRef.current;
      const result = pruneLeft(before, shelf, held);
      if (result.length === before.length) return;
      keepFocus(before, result);
      cardsRef.current = result;
      setCards(result);
    },
    [shelf, keepFocus],
  );

  const showToast = useCallback(
    (message: string, animeId: number | null, action?: Toast["action"]) => {
      // A new toast closes the last one: titles it was holding back leave.
      prune(animeId);
      toastId.current += 1;
      const next = { id: toastId.current, message, action, animeId };
      toastRef.current = next;
      setToast(next);
    },
    [prune],
  );

  const adoptIfIdle = useCallback(() => {
    const fresh = incomingRef.current;
    if (!fresh || toastRef.current || heldRef.current !== null) return;
    if (loadingRef.current) return;
    for (const count of pending.current.values()) if (count > 0) return;
    incomingRef.current = null;
    setIncoming(null);
    if (edits.current !== editsAtRequest.current) {
      // Edited here since: this snapshot may not have those edits yet.
      editsAtRequest.current = edits.current;
      router.refresh();
      return;
    }
    // Fresh first page, then what "Show more" had loaded, from where it was.
    const before = cardsRef.current;
    const freshIds = new Set(fresh.cards.map((c) => c.animeId));
    const extra = before.filter(
      (c) => extraIds.current.has(c.animeId) && !freshIds.has(c.animeId),
    );
    const merged = [...fresh.cards, ...extra];
    keepFocus(before, merged);
    cardsRef.current = merged;
    setCards(merged);
    setCounts(fresh.counts);
    if (extra.length === 0) {
      extraIds.current.clear();
      setNext(fresh.next);
    }
  }, [keepFocus, router]);
  useEffect(() => {
    incomingRef.current = incoming;
    adoptIfIdle();
  }, [incoming, adoptIfIdle]);

  const dismissToast = useCallback(() => {
    undoRef.current = null;
    toastRef.current = null;
    setToast(null);
    prune(null);
    adoptIfIdle();
  }, [prune, adoptIfIdle]);

  const undo = useCallback(async () => {
    const entry = undoRef.current;
    if (!entry) return;
    undoRef.current = null;
    const id = entry.animeId;
    edits.current += 1;
    const card = cardsRef.current.find((c) => c.animeId === id);
    // Held while the undo saves, so a toast closing meanwhile can't prune it.
    pending.current.set(id, (pending.current.get(id) ?? 0) + 1);
    const result = await safely(() => deckUndo(entry.eventId));
    pending.current.set(id, (pending.current.get(id) ?? 1) - 1);
    if (!result.ok) {
      showToast(result.error, entry.animeId);
      setAnnouncement(result.error);
      return;
    }
    confirmed.current.set(entry.animeId, result.state);
    applyState(entry.animeId, result.state);
    const message = `Undone: ${entry.label.toLowerCase()}`;
    showToast(message, entry.animeId);
    setAnnouncement(card ? `${message}: ${card.title}.` : `${message}.`);
  }, [applyState, showToast]);

  // Try again re-runs the same save; through a ref, since it's `save` itself.
  const retryRef = useRef<
    (card: LibraryCard, intent: SaveIntent) => Promise<void>
  >(async () => {});
  const save = useCallback(
    async (card: LibraryCard, intent: SaveIntent): Promise<void> => {
      const id = card.animeId;
      const live = cardsRef.current.find((c) => c.animeId === id);
      if (!live) return;
      edits.current += 1;
      const inFlight = pending.current.get(id) ?? 0;
      if (inFlight === 0) confirmed.current.set(id, live.state);
      pending.current.set(id, inFlight + 1);
      applyState(id, intent.optimistic);

      const result = await safely(intent.call);
      const left = (pending.current.get(id) ?? 1) - 1;
      pending.current.set(id, left);

      if (!result.ok) {
        if (result.gone) {
          const remaining = cardsRef.current.filter((c) => c.animeId !== id);
          const removed = cardsRef.current.find((c) => c.animeId === id);
          cardsRef.current = remaining;
          setCards(remaining);
          if (removed) {
            const empty = {
              status: null,
              rating: null,
              liked: false,
              watchlisted: false,
            };
            setCounts((counts) => shiftCounts(counts, removed.state, empty));
          }
          showToast(GONE, null);
          setAnnouncement(GONE);
          return;
        }
        if (left === 0) {
          applyState(id, confirmed.current.get(id) ?? card.state);
        }
        undoRef.current = null;
        showToast(result.error, id, {
          kind: "retry",
          onClick: () => void retryRef.current(card, intent),
        });
        setAnnouncement(result.error);
        return;
      }

      confirmed.current.set(id, result.state);
      if (left === 0) applyState(id, result.state);
      if (
        env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
        env.NEXT_PUBLIC_POSTHOG_HOST
      ) {
        posthog.capture("library_title_updated", {
          status: result.state.status,
          rating: result.state.rating,
          liked: result.state.liked,
          watchlisted: result.state.watchlisted,
        });
      }
      undoRef.current = {
        eventId: result.eventId,
        animeId: id,
        label: intent.label,
      };
      showToast(intent.label, id, {
        kind: "undo",
        onClick: () => void undo(),
      });
      setAnnouncement(`${intent.label}: ${card.title}.`);
    },
    [applyState, showToast, undo],
  );

  useEffect(() => {
    retryRef.current = save;
  }, [save]);

  const loadMore = useCallback(async () => {
    if (!next || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    setLoadError(null);
    let result: Awaited<ReturnType<typeof loadLibraryPage>>;
    try {
      result = await loadLibraryPage(shelf, sort, next);
    } catch {
      result = { error: NETWORK };
    }
    loadingRef.current = false;
    setLoadingMore(false);
    if ("error" in result) {
      setLoadError(result.error);
      adoptIfIdle();
      return;
    }
    const known = new Set(cardsRef.current.map((card) => card.animeId));
    const fresh = result.cards.filter((card) => !known.has(card.animeId));
    for (const card of fresh) extraIds.current.add(card.animeId);
    const updated = [...cardsRef.current, ...fresh];
    cardsRef.current = updated;
    setCards(updated);
    setNext(fresh.length === 0 ? null : result.next);
    const first = fresh[0];
    if (first) requestFocus(first.animeId);
    setAnnouncement(
      fresh.length === 0
        ? "That's everything on this shelf."
        : `${fresh.length} more ${fresh.length === 1 ? "title" : "titles"} loaded.`,
    );
    adoptIfIdle();
  }, [next, shelf, sort, requestFocus, adoptIfIdle]);

  return {
    cards,
    counts,
    hasMore: next !== null,
    loadingMore,
    loadError,
    loadMore,
    focusRequest,
    toast,
    dismissToast,
    announcement,
    announce: setAnnouncement,
    save,
    /** Keeps a title in the grid while its edit sheet is open. */
    hold: useCallback((animeId: number) => {
      heldRef.current = animeId;
    }, []),
    /**
     * The sheet closed: the title may leave now, unless its toast is still
     * up (then it leaves when the toast closes, as usual).
     */
    release: useCallback(() => {
      heldRef.current = null;
      prune(toastRef.current?.animeId ?? null);
      adoptIfIdle();
    }, [prune, adoptIfIdle]),
    /** Ctrl/Cmd+Z: the toast's Undo, if it has one. */
    undo,
  };
}
