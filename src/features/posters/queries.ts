import "server-only";

import { after } from "next/server";

import { env } from "@/env";
import {
  logPosterLookupCompleted,
  logPosterSourcesResolved,
} from "@/lib/posthog-logs";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

import { MAX_ANILIST_IDS, fetchAniListCovers, isPaused } from "./anilist";
import { type PosterCandidate, resolvePosterUrls } from "./resolve";

/** Most anime ids one call may ask for (one grid page is far fewer). */
export const MAX_POSTER_IDS = 100;

/**
 * How the catalog import stores AniList links (`normalizeUrl` in
 * src/sync/normalize.ts): the host as the site, the path as the id, e.g.
 * `anilist.co` + `/anime/154587`.
 */
const ANILIST_SITE = "anilist.co";
const ANILIST_PATH = /^\/anime\/([1-9][0-9]{0,9})$/;

/** How long a "looked up, no cover" mark keeps a title from being asked again. */
export const MISS_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

export type PosterOptions = {
  /**
   * Look up AniList covers for titles that have none stored (decision 0017).
   * Only for pages about to show these titles: the deck and the library.
   */
  lookUp?: boolean;
};

/**
 * Poster URLs for each anime, best source first. Anime with no usable poster
 * are left out of the map; the UI shows the generated poster for them.
 */
export async function getPosterSources(
  animeIds: readonly number[],
  { lookUp = false }: PosterOptions = {},
): Promise<Map<number, string[]>> {
  const ids = [...new Set(animeIds)];
  if (ids.length === 0) return new Map();
  if (ids.length > MAX_POSTER_IDS) {
    throw new RangeError(
      `getPosterSources takes at most ${MAX_POSTER_IDS} anime ids, got ${ids.length}.`,
    );
  }

  const supabase = createPublicClient();
  const [{ data, error }, anilist] = await Promise.all([
    supabase
      .schema("catalog")
      .from("poster_candidates")
      .select("anime_id, source, priority, url, storage_path")
      .in("anime_id", ids)
      .order("priority"),
    lookUp && !isPaused() ? aniListSource() : Promise.resolve(null),
  ]);
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

  if (anilist) {
    const missing = ids.filter(
      (id) => !byAnime.get(id)?.some((c) => c.source === "anilist"),
    );
    const found = await lookUpCovers(missing, anilist);
    for (const [animeId, url] of found) {
      const list = byAnime.get(animeId) ?? [];
      list.push({
        source: "anilist",
        priority: anilist.priority,
        url,
        storage_path: null,
      });
      list.sort((a, b) => a.priority - b.priority);
      byAnime.set(animeId, list);
    }
  }

  const result = new Map<number, string[]>();
  for (const [animeId, candidates] of byAnime) {
    const urls = resolvePosterUrls(candidates, env.NEXT_PUBLIC_SUPABASE_URL);
    if (urls.length > 0) result.set(animeId, urls);
  }

  logPosterSourcesResolved({
    requested_title_count: ids.length,
    resolved_title_count: result.size,
    lookup_requested: lookUp,
  });
  return result;
}

type AniListSource = { id: number; priority: number };

/** The AniList source, or null when it is switched off (0008's switch). */
async function aniListSource(): Promise<AniListSource | null> {
  try {
    const { data, error } = await createPublicClient()
      .schema("catalog")
      .from("image_sources")
      .select("id, priority, is_enabled")
      .eq("slug", "anilist")
      .maybeSingle();
    if (error || !data?.is_enabled) return null;
    return { id: data.id, priority: data.priority };
  } catch {
    return null;
  }
}

/**
 * Asks AniList once for titles with no AniList cover stored, an AniList id,
 * and no recent "no cover" mark. Returns the covers it found and records the
 * results after the response. Never throws: a failure means no new covers.
 */
async function lookUpCovers(
  animeIds: number[],
  source: AniListSource,
): Promise<Map<number, string>> {
  const found = new Map<number, string>();
  if (animeIds.length === 0) return found;

  try {
    const supabase = createPublicClient();
    const since = new Date(Date.now() - MISS_TTL_MS).toISOString();
    const [misses, mappings] = await Promise.all([
      supabase
        .schema("catalog")
        .from("anime_image_misses")
        .select("anime_id")
        .in("anime_id", animeIds)
        .eq("kind", "poster")
        .eq("source_id", source.id)
        .gte("checked_at", since),
      supabase
        .schema("catalog")
        .from("external_ids")
        .select("anime_id, external_id")
        .eq("site", ANILIST_SITE)
        .in("anime_id", animeIds),
    ]);
    if (misses.error || mappings.error) return found;

    const recentlyMissed = new Set(misses.data.map((row) => row.anime_id));
    // AniList id -> our anime id, first mapping per anime.
    const targets = new Map<number, number>();
    const mapped = new Set<number>();
    for (const row of mappings.data) {
      const anilistId = Number(ANILIST_PATH.exec(row.external_id)?.[1]);
      if (
        recentlyMissed.has(row.anime_id) ||
        mapped.has(row.anime_id) ||
        !Number.isSafeInteger(anilistId) ||
        anilistId < 1 ||
        targets.has(anilistId)
      ) {
        continue;
      }
      targets.set(anilistId, row.anime_id);
      mapped.add(row.anime_id);
      if (targets.size === MAX_ANILIST_IDS) break;
    }
    if (targets.size === 0) return found;

    // Read the session now: request data isn't available inside after().
    const recorder = await createClient();
    const lookup = await fetchAniListCovers([...targets.keys()]);
    if (!lookup.ok) return found;

    const items: { anime_id: number; url: string | null }[] = [];
    for (const [anilistId, animeId] of targets) {
      const url = lookup.covers.get(anilistId) ?? null;
      items.push({ anime_id: animeId, url });
      if (url) found.set(animeId, url);
    }

    logPosterLookupCompleted({
      requested_title_count: targets.size,
      cover_found_count: found.size,
    });

    after(async () => {
      const { error } = await recorder
        .schema("catalog")
        .rpc("record_anilist_covers", { p_covers: items });
      // Not fatal: the titles are looked up again on a later view.
      if (error) console.error("record_anilist_covers failed", error.message);
    });
  } catch {
    // Fail soft (0017): the page renders with the posters it has.
  }
  return found;
}
