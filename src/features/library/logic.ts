import { ratingToStars } from "@/features/tracking/schemas";
import type { TrackingState } from "@/features/tracking/schemas";

import {
  ALWAYS_SHOWN,
  DEFAULT_SHELF,
  DEFAULT_SORT,
  type LibraryCard,
  SHELF_LABELS,
  SHELVES,
  type Shelf,
  type ShelfCounts,
  type Sort,
} from "./types";

/**
 * Tabs to show (0016): Watched, Watchlist and Liked always; the other
 * statuses only when they have titles. The open shelf always shows, so an
 * edit that empties it doesn't pull the tab out from under you.
 */
export function visibleShelves(counts: ShelfCounts, current: Shelf): Shelf[] {
  return SHELVES.filter(
    (shelf) =>
      ALWAYS_SHOWN.includes(shelf) || counts[shelf] > 0 || shelf === current,
  );
}

/** Whether a title with this state belongs on the shelf. */
export function shelfContains(shelf: Shelf, state: TrackingState): boolean {
  if (shelf === "watchlist") return state.watchlisted;
  if (shelf === "liked") return state.liked;
  return state.status === shelf;
}

/** Shelf counts after a title's state changes from `before` to `after`. */
export function shiftCounts(
  counts: ShelfCounts,
  before: TrackingState,
  after: TrackingState,
): ShelfCounts {
  const next = { ...counts };
  for (const shelf of SHELVES) {
    next[shelf] +=
      Number(shelfContains(shelf, after)) -
      Number(shelfContains(shelf, before));
  }
  return next;
}

/**
 * Cards that left the shelf after an edit stay, dimmed, until their toast
 * closes (spec 07 #13). When it closes, the ones still off the shelf go,
 * except those in `keep` (the title the next toast is about, whose Undo can
 * still bring it back, and titles still saving).
 */
export function pruneLeft<T extends Pick<LibraryCard, "animeId" | "state">>(
  cards: T[],
  shelf: Shelf,
  keep: ReadonlySet<number>,
): T[] {
  return cards.filter(
    (card) => keep.has(card.animeId) || shelfContains(shelf, card.state),
  );
}

/** "/library?shelf=dropped&sort=rating", leaving out the defaults. */
export function libraryHref(shelf: Shelf, sort: Sort): string {
  const params = new URLSearchParams();
  if (shelf !== DEFAULT_SHELF) params.set("shelf", shelf);
  if (sort !== DEFAULT_SORT) params.set("sort", sort);
  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}

const STATUS_WORDS = {
  watched: "Watched",
  watching: "Watching",
  on_hold: "On hold",
  dropped: "Dropped",
} as const;

/** "3.5 stars" / "1 star". */
export function starsText(rating: number): string {
  const stars = ratingToStars(rating);
  return `${stars} ${stars === 1 ? "star" : "stars"}`;
}

/**
 * The card's accessible name (spec 07 #16): the full title, then the status,
 * rating, like and watchlist when set.
 */
export function cardLabel(card: Pick<LibraryCard, "title" | "state">): string {
  const { status, rating, liked, watchlisted } = card.state;
  return [
    card.title,
    status ? STATUS_WORDS[status] : null,
    rating ? `rated ${starsText(rating)}` : null,
    liked ? "liked" : null,
    watchlisted ? "on your watchlist" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** The shelf's tab label with its count, for screen readers: "Watched, 12 titles". */
export function shelfTabLabel(shelf: Shelf, count: number): string {
  return `${SHELF_LABELS[shelf]}, ${count} ${count === 1 ? "title" : "titles"}`;
}
