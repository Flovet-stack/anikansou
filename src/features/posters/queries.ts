import "server-only";

import { env } from "@/env";
import { createPublicClient } from "@/lib/supabase/public";

import { type PosterCandidate, resolvePosterUrls } from "./resolve";

/** Most anime ids one call may ask for (one grid page is far fewer). */
export const MAX_POSTER_IDS = 100;

/**
 * Poster URLs for each anime, best source first. Anime with no usable poster
 * are left out of the map; the UI shows the generated poster for them.
 */
export async function getPosterSources(
  animeIds: readonly number[],
): Promise<Map<number, string[]>> {
  const ids = [...new Set(animeIds)];
  if (ids.length === 0) return new Map();
  if (ids.length > MAX_POSTER_IDS) {
    throw new RangeError(
      `getPosterSources takes at most ${MAX_POSTER_IDS} anime ids, got ${ids.length}.`,
    );
  }

  const { data, error } = await createPublicClient()
    .schema("catalog")
    .from("poster_candidates")
    .select("anime_id, source, priority, url, storage_path")
    .in("anime_id", ids)
    .order("priority");
  if (error) throw error;

  const byAnime = new Map<number, PosterCandidate[]>();
  for (const row of data) {
    if (row.anime_id === null || row.source === null || row.priority === null) {
      continue;
    }
    const list = byAnime.get(row.anime_id) ?? [];
    list.push({
      source: row.source,
      priority: row.priority,
      url: row.url,
      storage_path: row.storage_path,
    });
    byAnime.set(row.anime_id, list);
  }

  const result = new Map<number, string[]>();
  for (const [animeId, candidates] of byAnime) {
    const urls = resolvePosterUrls(candidates, env.NEXT_PUBLIC_SUPABASE_URL);
    if (urls.length > 0) result.set(animeId, urls);
  }
  return result;
}
