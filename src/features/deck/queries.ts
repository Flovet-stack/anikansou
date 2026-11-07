import "server-only";

import { getPosterSources } from "@/features/posters/queries";
import { EMPTY_STATE } from "@/features/tracking/schemas";
import { createClient } from "@/lib/supabase/server";

import { type DeckCard, type DeckPage, FORMAT_LABELS } from "./types";

export const PAGE_SIZE = 10;

/**
 * The next deck page for the signed-in user (decision 0010): best-known
 * titles first, ordered by a score the database keeps private. `after` is the
 * last anime id the client has.
 */
export async function getDeckPage(after: number | null): Promise<DeckPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deck_next", {
    ...(after === null ? {} : { p_after: after }),
    p_page_size: PAGE_SIZE,
  });
  if (error) throw error;

  const rows = data ?? [];
  const ids = rows.map((row) => row.anime_id);
  const [posters, liked] = await Promise.all([
    getPosterSources(ids, { lookUp: true }),
    likedAmong(ids),
  ]);

  const cards: DeckCard[] = rows.map((row) => ({
    animeId: row.anime_id,
    title: row.title,
    // Generated types mark every column non-null; these can be null.
    nativeTitle: (row.native_title as string | null) ?? null,
    format: row.type ? (FORMAT_LABELS[row.type] ?? null) : null,
    year: (row.year as number | null) ?? null,
    season: (row.season as string | null) ?? null,
    episodes: (row.episodes as number | null) ?? null,
    durationMinutes: row.duration_seconds
      ? Math.round(row.duration_seconds / 60)
      : null,
    studios: row.studios ?? [],
    tags: row.tags ?? [],
    isUpcoming: row.is_upcoming === true,
    isAdult: row.is_adult === true,
    posterUrls: posters.get(row.anime_id) ?? [],
    state: { ...EMPTY_STATE, liked: liked.has(row.anime_id) },
  }));

  return { cards, done: rows.length < PAGE_SIZE };
}

/** Liked-only anime still appear in the deck (0010); show their heart. */
async function likedAmong(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_anime")
    .select("anime_id")
    .in("anime_id", ids)
    .eq("liked", true);
  if (error) throw error;
  return new Set(data.map((row) => row.anime_id));
}

/** How many anime the user has rated, for the milestones (0009). */
export async function getRatedCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("user_anime")
    .select("anime_id", { count: "exact", head: true })
    .not("rating", "is", null);
  if (error) throw error;
  return count ?? 0;
}
