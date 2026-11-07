import type { LibraryCard } from "@/features/library/types";

/**
 * One search result (decision 0018): the Library card's fields, plus the
 * adult flag (0010) and the title that matched when it isn't the shown one.
 * Never the aggregate score or a similarity value.
 */
export type SearchCard = LibraryCard & {
  isAdult: boolean;
  matchedTitle: string | null;
};

export type SearchPage = {
  cards: SearchCard[];
  /** How many anime matched, capped at 201 ("200+"). */
  total: number;
};
