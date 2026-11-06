import type { TrackingState } from "@/features/tracking/schemas";

/** One card in the deck (decision 0010). Never carries the aggregate score. */
export type DeckCard = {
  animeId: number;
  title: string;
  nativeTitle: string | null;
  format: string | null;
  year: number | null;
  season: string | null;
  episodes: number | null;
  durationMinutes: number | null;
  studios: string[];
  tags: string[];
  isUpcoming: boolean;
  isAdult: boolean;
  /** Poster URLs, best first; empty means the generated poster. */
  posterUrls: string[];
  /** Saved state (only a like can be set before a card appears). */
  state: TrackingState;
};

export type DeckPage = { cards: DeckCard[]; done: boolean };

export const FORMAT_LABELS: Record<string, string> = {
  tv: "TV",
  movie: "Movie",
  ona: "ONA",
  ova: "OVA",
  special: "Special",
};

const SEASON_LABELS: Record<string, string> = {
  winter: "Winter",
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
};

/** "TV · 2023 · 28 eps" or "Movie · 2016 · 1 h 46 min" (decision 0006). */
export function metaLine(card: DeckCard): string {
  const length =
    card.format === "Movie" && card.durationMinutes
      ? formatMinutes(card.durationMinutes)
      : card.episodes
        ? `${card.episodes} ${card.episodes === 1 ? "ep" : "eps"}`
        : null;
  return [card.format, card.year, length].filter(Boolean).join(" · ");
}

/** "Madhouse · Fall 2023" (decision 0010). */
export function studioLine(card: DeckCard): string {
  const season =
    card.season && card.year
      ? `${SEASON_LABELS[card.season] ?? card.season} ${card.year}`
      : null;
  return [card.studios.slice(0, 2).join(", ") || null, season]
    .filter(Boolean)
    .join(" · ");
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}
