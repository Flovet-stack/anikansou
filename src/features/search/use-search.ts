"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ActionToastProps } from "@/components/feedback/action-toast";
import type { SaveCard } from "@/features/library/card-actions";
import type { LibraryCard } from "@/features/library/types";
import { safely } from "@/features/library/use-library";
import { deckUndo } from "@/features/tracking/actions";
import type { TrackingState } from "@/features/tracking/schemas";

import { loadSearchPage } from "./actions";
import {
  MAX_RESULTS,
  SEARCH_DEBOUNCE_MS,
  clampInput,
  discoverHref,
  isSearchable,
  resultsText,
} from "./logic";
import type { SearchCard, SearchPage } from "./types";

const NETWORK = "Search isn't working right now.";
const GONE = "That anime is no longer in the catalog, so it was removed.";

/** The results on screen, and the query they belong to. */
export type Results = { query: string; cards: SearchCard[]; total: number };

export type SearchStatus = "idle" | "loading" | "ready" | "error";

type Toast = ActionToastProps;
type Undo = { eventId: number; animeId: number; label: string };

/**
 * Discover's search (spec 09, decision 0018): the field, a 250 ms debounce,
 * `?q=` kept with `history.replaceState`, a guard so a late reply never
 * overwrites a newer query, "Show more", and optimistic saves with Undo for
 * signed-in users. Below 2 real characters no request is sent.
 */
export function useSearch({
  initialQuery,
  initialPage,
  initialError = false,
}: {
  initialQuery: string;
  /** Server-rendered first page for `?q=`, or null when nothing was searched. */
  initialPage: SearchPage | null;
  initialError?: boolean;
}) {
  const [input, setInput] = useState(initialQuery);
  const [results, setResults] = useState<Results | null>(
    initialPage ? { query: initialQuery, ...initialPage } : null,
  );
  const [status, setStatus] = useState<SearchStatus>(
    initialError ? "error" : initialPage ? "ready" : "idle",
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [focusRequest, setFocusRequest] = useState<{
    target: number;
    n: number;
  } | null>(null);

  /** Bumped by every new search: replies for an older one are dropped. */
  const requestId = useRef(0);
  const timer = useRef<number | null>(null);
  const resultsRef = useRef(results);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const cancelTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancelTimer, []);

  const run = useCallback(async (query: string) => {
    cancelTimer();
    const id = ++requestId.current;
    // The URL follows the search, without a history entry per query (0018).
    window.history.replaceState(window.history.state, "", discoverHref(query));
    if (!isSearchable(query)) {
      setResults(null);
      setStatus("idle");
      setLoadError(null);
      return;
    }
    setStatus("loading");
    setLoadError(null);
    let page: Awaited<ReturnType<typeof loadSearchPage>>;
    try {
      page = await loadSearchPage(query, 0);
    } catch {
      page = { error: NETWORK };
    }
    if (id !== requestId.current) return;
    if ("error" in page) {
      setStatus("error");
      setAnnouncement(page.error);
      return;
    }
    setResults({ query, ...page });
    setStatus("ready");
    setAnnouncement(
      page.total === 0
        ? `No anime match "${query.trim()}".`
        : resultsText(page.total, query),
    );
  }, []);

  /** Typing: search 250 ms after the last keystroke. */
  const change = useCallback(
    (raw: string) => {
      const value = clampInput(raw);
      setInput(value);
      cancelTimer();
      if (!isSearchable(value)) {
        // Too short: nothing to wait for, and any reply in flight is stale.
        void run(value);
        return;
      }
      timer.current = window.setTimeout(
        () => void run(value),
        SEARCH_DEBOUNCE_MS,
      );
    },
    [run],
  );

  /** Enter: search now. */
  const submit = useCallback(() => void run(input), [run, input]);

  /** Esc or the clear button. */
  const clear = useCallback(() => {
    setInput("");
    void run("");
  }, [run]);

  const retry = useCallback(() => void run(input), [run, input]);

  const loadMore = useCallback(async () => {
    const current = resultsRef.current;
    if (!current || loadingMore) return;
    const offset = current.cards.length;
    if (offset >= Math.min(current.total, MAX_RESULTS)) return;
    const id = requestId.current;
    setLoadingMore(true);
    setLoadError(null);
    let page: Awaited<ReturnType<typeof loadSearchPage>>;
    try {
      page = await loadSearchPage(current.query, offset);
    } catch {
      page = { error: NETWORK };
    }
    setLoadingMore(false);
    // A new search started meanwhile: this page belongs to the old one.
    if (id !== requestId.current) return;
    if ("error" in page) {
      setLoadError("Couldn't load more. Check your connection and try again.");
      return;
    }
    const known = new Set(current.cards.map((c) => c.animeId));
    const fresh = page.cards.filter((c) => !known.has(c.animeId));
    const next = { ...current, cards: [...current.cards, ...fresh] };
    resultsRef.current = next;
    setResults(next);
    const first = fresh[0];
    if (first) {
      setFocusRequest((last) => ({
        target: first.animeId,
        n: (last?.n ?? 0) + 1,
      }));
    }
    setAnnouncement(
      `${fresh.length} more ${fresh.length === 1 ? "result" : "results"} loaded.`,
    );
  }, [loadingMore]);

  // --- Saves (signed in): optimistic, with Undo, as in the Library. -------

  const toastId = useRef(0);
  const undoRef = useRef<Undo | null>(null);
  const pending = useRef(new Map<number, number>());
  const confirmed = useRef(new Map<number, TrackingState>());

  const applyState = useCallback((animeId: number, state: TrackingState) => {
    const current = resultsRef.current;
    if (!current) return;
    const next = {
      ...current,
      cards: current.cards.map((card) =>
        card.animeId === animeId ? { ...card, state } : card,
      ),
    };
    resultsRef.current = next;
    setResults(next);
  }, []);

  const showToast = useCallback((message: string, action?: Toast["action"]) => {
    toastId.current += 1;
    setToast({ id: toastId.current, message, action });
  }, []);

  const dismissToast = useCallback(() => {
    undoRef.current = null;
    setToast(null);
  }, []);

  const undo = useCallback(async () => {
    const entry = undoRef.current;
    if (!entry) return;
    undoRef.current = null;
    const id = entry.animeId;
    pending.current.set(id, (pending.current.get(id) ?? 0) + 1);
    const result = await safely(() => deckUndo(entry.eventId));
    pending.current.set(id, (pending.current.get(id) ?? 1) - 1);
    if (!result.ok) {
      showToast(result.error);
      setAnnouncement(result.error);
      return;
    }
    confirmed.current.set(id, result.state);
    applyState(id, result.state);
    const card = resultsRef.current?.cards.find((c) => c.animeId === id);
    const message = `Undone: ${entry.label.toLowerCase()}`;
    showToast(message);
    setAnnouncement(card ? `${message}: ${card.title}.` : `${message}.`);
  }, [applyState, showToast]);

  const retryRef = useRef<SaveCard>(async () => {});
  const save: SaveCard = useCallback(
    async (card: LibraryCard, intent) => {
      const id = card.animeId;
      const live = resultsRef.current?.cards.find((c) => c.animeId === id);
      if (!live) return;
      const inFlight = pending.current.get(id) ?? 0;
      if (inFlight === 0) confirmed.current.set(id, live.state);
      pending.current.set(id, inFlight + 1);
      applyState(id, intent.optimistic);

      const result = await safely(intent.call);
      const left = (pending.current.get(id) ?? 1) - 1;
      pending.current.set(id, left);

      if (!result.ok) {
        if (result.gone) {
          const current = resultsRef.current;
          if (current) {
            const next = {
              ...current,
              cards: current.cards.filter((c) => c.animeId !== id),
            };
            resultsRef.current = next;
            setResults(next);
          }
          showToast(GONE);
          setAnnouncement(GONE);
          return;
        }
        // An older reply never overwrites a newer choice (as in the deck).
        if (left === 0) applyState(id, confirmed.current.get(id) ?? card.state);
        undoRef.current = null;
        showToast(result.error, {
          kind: "retry",
          onClick: () => void retryRef.current(card, intent),
        });
        setAnnouncement(result.error);
        return;
      }

      confirmed.current.set(id, result.state);
      if (left === 0) applyState(id, result.state);
      undoRef.current = {
        eventId: result.eventId,
        animeId: id,
        label: intent.label,
      };
      showToast(intent.label, { kind: "undo", onClick: () => void undo() });
      setAnnouncement(`${intent.label}: ${card.title}.`);
    },
    [applyState, showToast, undo],
  );
  useEffect(() => {
    retryRef.current = save;
  }, [save]);

  const shown = results?.cards.length ?? 0;
  const hasMore =
    results !== null && shown < Math.min(results.total, MAX_RESULTS);

  return {
    input,
    change,
    submit,
    clear,
    retry,
    status,
    results,
    hasMore,
    loadMore,
    loadingMore,
    loadError,
    focusRequest,
    announcement,
    toast,
    dismissToast,
    save,
    undo,
  };
}
