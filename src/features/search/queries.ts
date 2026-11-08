import "server-only";

import { FORMAT_LABELS } from "@/features/deck/types";
import { getPosterSources } from "@/features/posters/queries";
import { statusSchema } from "@/features/tracking/schemas";
import { createClient } from "@/lib/supabase/server";

import { type Filters, STATUS_TO_DB, yearRange } from "./filters";
import { SEARCH_PAGE_SIZE, normalizeQuery } from "./logic";
import type { SearchCard, SearchPage } from "./types";

/**
 * A page of results (decisions 0018 and 0020) from the `search_anime`
 * database function: a query, filters, or both. Works signed out; signed in,
 * each card carries the caller's own state.
 */
export async function searchAnime(
  query: string,
  filters: Filters,
  offset: number,
): Promise<SearchPage> {
  const supabase = await createClient();
  const normalized = normalizeQuery(query);
  const { from, to } = yearRange(filters.year);
  const { data, error } = await supabase.rpc("search_anime", {
    ...(normalized ? { p_query: normalized } : {}),
    p_offset: offset,
    p_limit: SEARCH_PAGE_SIZE,
    ...(filters.types.length > 0 ? { p_types: filters.types } : {}),
    ...(filters.genres.length > 0 ? { p_genres: filters.genres } : {}),
    ...(from === null ? {} : { p_year_from: from }),
    ...(to === null ? {} : { p_year_to: to }),
    ...(filters.season === null ? {} : { p_season: filters.season }),
    ...(filters.status === null
      ? {}
      : { p_status: STATUS_TO_DB[filters.status] }),
    p_sort: filters.sort,
  });
  if (error) throw error;

  const rows = data ?? [];
  const posters = await getPosterSources(rows.map((row) => row.anime_id));
  const cards: SearchCard[] = rows.map((row) => {
    const status = statusSchema.safeParse(row.status);
    return {
      animeId: row.anime_id,
      title: row.title,
      // Generated types mark every column non-null; these can be null.
      nativeTitle: (row.native_title as string | null) ?? null,
      format: row.type ? (FORMAT_LABELS[row.type] ?? null) : null,
      year: (row.year as number | null) ?? null,
      episodes: (row.episodes as number | null) ?? null,
      durationMinutes: row.duration_seconds
        ? Math.round(row.duration_seconds / 60)
        : null,
      isUpcoming: row.is_upcoming === true,
      isAdult: row.is_adult === true,
      matchedTitle: (row.matched_title as string | null) ?? null,
      posterUrls: posters.get(row.anime_id) ?? [],
      state: {
        status: status.success ? status.data : null,
        rating: (row.rating as number | null) ?? null,
        liked: row.liked === true,
        watchlisted: row.watchlisted === true,
      },
    };
  });
  return { cards, total: rows[0]?.total ?? 0 };
}

/** The catalog's latest year, which starts the Year menu (0020). */
export async function getLatestYear(): Promise<number> {
  const fallback = new Date().getFullYear() + 1;
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("catalog")
    .from("anime")
    .select("year")
    .is("retired_at", null)
    .not("year", "is", null)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return fallback;
  return data?.year ?? fallback;
}
