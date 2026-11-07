import "server-only";

import { z } from "zod";

/**
 * AniList cover lookups (spec 08, decision 0017). The only AniList call the
 * app makes: one GraphQL request for up to 50 anime covers, from the server,
 * for titles a page is about to show. Never throws; on any failure the page
 * keeps the posters it already has.
 */

export const ANILIST_ENDPOINT = "https://graphql.anilist.co";

/** AniList's page size cap, and the most `record_anilist_covers` takes. */
export const MAX_ANILIST_IDS = 50;

export const TIMEOUT_MS = 1_500;

/** How long to stop asking after a 429 without a usable `Retry-After`. */
export const RATE_LIMIT_PAUSE_MS = 60_000;

/** The longest `Retry-After` we honour, so a bad header can't stop covers for good. */
const MAX_PAUSE_MS = 15 * 60_000;

/** The only links we keep; `record_anilist_covers` accepts nothing else. */
const COVER_LINK =
  /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/media\/anime\/cover\/[A-Za-z0-9._/-]+$/;

const QUERY = `query Covers($ids: [Int]) {
  Page(perPage: ${MAX_ANILIST_IDS}) {
    media(id_in: $ids, type: ANIME) {
      id
      coverImage { extraLarge large }
    }
  }
}`;

const link = z.string().nullish();

const responseSchema = z.object({
  data: z.object({
    Page: z.object({
      media: z.array(
        z.object({
          id: z.number().int(),
          coverImage: z.object({ extraLarge: link, large: link }).nullish(),
        }),
      ),
    }),
  }),
});

export type CoverLookup =
  /** AniList answered: a cover link (or null) for every id asked about. */
  { ok: true; covers: Map<number, string | null> } | { ok: false };

// Per server instance. A 429 pauses every lookup on this instance.
let pausedUntil = 0;

/** Whether a 429 is still keeping us from asking AniList. */
export function isPaused(now = Date.now()): boolean {
  return now < pausedUntil;
}

/** Test-only: forget any pause. */
export function resetAniListPause(): void {
  pausedUntil = 0;
}

function pauseFor(retryAfter: string | null, now: number): number {
  if (retryAfter !== null && retryAfter.trim() !== "") {
    const seconds = Number(retryAfter);
    const ms = Number.isFinite(seconds)
      ? seconds * 1_000
      : Date.parse(retryAfter) - now;
    if (Number.isFinite(ms) && ms > 0) return Math.min(ms, MAX_PAUSE_MS);
  }
  return RATE_LIMIT_PAUSE_MS;
}

function keepCover(url: string | null | undefined): string | null {
  return url && COVER_LINK.test(url) && !url.includes("..") ? url : null;
}

/**
 * Asks AniList for the covers of up to 50 AniList anime ids in one request.
 * Ids AniList doesn't return, or returns without a usable cover, map to null.
 */
export async function fetchAniListCovers(
  anilistIds: readonly number[],
): Promise<CoverLookup> {
  const ids = [...new Set(anilistIds)].slice(0, MAX_ANILIST_IDS);
  if (ids.length === 0) return { ok: true, covers: new Map() };
  if (isPaused()) return { ok: false };

  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: QUERY, variables: { ids } }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Timeout, DNS or network failure.
    return { ok: false };
  }

  if (response.status === 429) {
    const now = Date.now();
    pausedUntil = now + pauseFor(response.headers.get("Retry-After"), now);
    return { ok: false };
  }
  if (!response.ok) return { ok: false };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false };
  }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) return { ok: false };

  const covers = new Map<number, string | null>(ids.map((id) => [id, null]));
  for (const media of parsed.data.data.Page.media) {
    if (!covers.has(media.id)) continue;
    covers.set(
      media.id,
      keepCover(media.coverImage?.extraLarge) ??
        keepCover(media.coverImage?.large),
    );
  }
  return { ok: true, covers };
}
