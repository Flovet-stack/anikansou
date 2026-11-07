import type { TrackingState } from "@/features/tracking/schemas";

/** Library shelves (decision 0016), in tab order. */
export const SHELVES = [
  "watched",
  "watching",
  "on_hold",
  "dropped",
  "watchlist",
  "liked",
] as const;
export type Shelf = (typeof SHELVES)[number];

export const SHELF_LABELS: Record<Shelf, string> = {
  watched: "Watched",
  watching: "Watching",
  on_hold: "On hold",
  dropped: "Dropped",
  watchlist: "Watchlist",
  liked: "Liked",
};

/** Shown even when empty, so a new user sees three tabs, not six (0016). */
export const ALWAYS_SHOWN: readonly Shelf[] = ["watched", "watchlist", "liked"];

export const SORTS = ["updated", "rating", "title", "year"] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABELS: Record<Sort, string> = {
  updated: "Recently updated",
  rating: "Your rating",
  title: "Title (A–Z)",
  year: "Year (newest first)",
};

export const DEFAULT_SHELF: Shelf = "watched";
export const DEFAULT_SORT: Sort = "updated";
export const LIBRARY_PAGE_SIZE = 48;

export type ShelfCounts = Record<Shelf, number>;

/** The database's keyset cursor: the last row's sort key and anime id. */
export type LibraryCursor = {
  sort: Sort;
  id: number;
  key: string | number;
};

/** One title in the Library grid (decision 0006). Never the aggregate score. */
export type LibraryCard = {
  animeId: number;
  title: string;
  nativeTitle: string | null;
  format: string | null;
  year: number | null;
  episodes: number | null;
  durationMinutes: number | null;
  isUpcoming: boolean;
  posterUrls: string[];
  state: TrackingState;
};

export type LibraryPage = {
  cards: LibraryCard[];
  /** Null when this was the last page. */
  next: LibraryCursor | null;
};

export function parseShelf(value: unknown): Shelf {
  return typeof value === "string" &&
    (SHELVES as readonly string[]).includes(value)
    ? (value as Shelf)
    : DEFAULT_SHELF;
}

export function parseSort(value: unknown): Sort | null {
  return typeof value === "string" &&
    (SORTS as readonly string[]).includes(value)
    ? (value as Sort)
    : null;
}
