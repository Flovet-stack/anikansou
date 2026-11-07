import {
  removeFromLibrary,
  setLike,
  setRating,
  setStatus,
  setWatchlist,
} from "@/features/tracking/actions";
import { STATUS_META } from "@/features/tracking/components/status-picker";
import {
  EMPTY_STATE,
  type WatchStatus,
  ratingToStars,
} from "@/features/tracking/schemas";

import type { LibraryCard } from "./types";
import type { SaveIntent } from "./use-library";

/** Saves one title optimistically, with an Undo (see useLibrary's save). */
export type SaveCard = (card: LibraryCard, intent: SaveIntent) => Promise<void>;

const STATUS_LABEL = (status: WatchStatus) => STATUS_META[status].label;

/**
 * Every edit on a card or in the edit sheet, as optimistic saves with an Undo
 * (spec 07 #12). Shared by the Library and search (spec 09).
 */
export function useCardActions(save: SaveCard) {
  return {
    toggleWatched(card: LibraryCard) {
      if (card.isUpcoming) return;
      const on = card.state.status !== "watched";
      const label = on
        ? "Marked watched"
        : card.state.rating !== null
          ? "Watched and rating removed"
          : "Watched removed";
      void save(card, {
        optimistic: {
          ...card.state,
          status: on ? "watched" : null,
          rating: on ? card.state.rating : null,
        },
        call: () => setStatus(card.animeId, on ? "watched" : null),
        label,
      });
    },
    setStatus(card: LibraryCard, status: WatchStatus | null) {
      if (card.isUpcoming || status === card.state.status) return;
      // Any status but Watched also removes the rating (0015).
      const dropsRating = status !== "watched" && card.state.rating !== null;
      const label =
        status === null
          ? dropsRating
            ? "Status and rating removed"
            : "Status removed"
          : `Moved to ${STATUS_LABEL(status)}${dropsRating ? ", rating removed" : ""}`;
      void save(card, {
        optimistic: {
          ...card.state,
          status,
          rating: status === "watched" ? card.state.rating : null,
        },
        call: () => setStatus(card.animeId, status),
        label,
      });
    },
    rate(card: LibraryCard, rating: number | null) {
      if (card.isUpcoming) return;
      if (rating !== null && card.state.status !== "watched") return;
      void save(card, {
        optimistic: { ...card.state, rating },
        call: () => setRating(card.animeId, rating),
        label:
          rating === null
            ? "Rating cleared"
            : `Rated ${ratingToStars(rating)} stars`,
      });
    },
    toggleLike(card: LibraryCard) {
      const liked = !card.state.liked;
      void save(card, {
        optimistic: { ...card.state, liked },
        call: () => setLike(card.animeId, liked),
        label: liked ? "Liked" : "Like removed",
      });
    },
    toggleWatchlist(card: LibraryCard) {
      const watchlisted = !card.state.watchlisted;
      void save(card, {
        optimistic: { ...card.state, watchlisted },
        call: () => setWatchlist(card.animeId, watchlisted),
        label: watchlisted ? "Added to watchlist" : "Removed from watchlist",
      });
    },
    remove(card: LibraryCard) {
      void save(card, {
        optimistic: EMPTY_STATE,
        call: () => removeFromLibrary(card.animeId),
        label: "Removed from library",
      });
    },
  };
}
