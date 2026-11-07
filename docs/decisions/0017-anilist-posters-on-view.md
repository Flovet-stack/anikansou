# 0017: AniList posters, looked up only for titles on screen

- **Status:** Approved
- **Proposed:** 2026-11-07 by the product team (roles: Product, Tech Lead, Backend, Database, Frontend)
- **Approved:** 2026-11-07 by Flovet ("Approve all three")
- **Supersedes:** part of [0008](0008-artwork-source.md): item 5 ("No external calls") and item 6 (AniList off until written permission). The rest of 0008 (ranked sources, locked hosts, fallback chain) stands.
- **Specs:** specs/08-anilist-posters.md

## Context

Flovet, 2026-11-07: "I want images to be shown you can either use anilist or jikan to load the images, only titles shown on the screen will have load images. Ignore the written permission for now."

Today every card shows the generated poster: no in-house or TMDB images have been added, and AniList is switched off. AniList cover addresses contain a code that only its API returns, so showing AniList images means calling the API. The brief and `CLAUDE.md` forbid calling any external anime API, so this decision changes both.

**Risk Flovet accepts by approving this:** AniList's terms exclude competing tracker services unless AniList authorises them, and forbid "hoarding or mass collection of data" (0008, research). Using the API without permission can get our server's address blocked or draw a takedown request. The generated poster stays as the fallback, so a block degrades the look, not the app. The legal check before monetising (brief) still applies.

## Research

| Source                             | How it works for us                                                                                                                                                                                                                  | Limits (checked 2026-11-07)                                                                                        | Decision  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------- |
| AniList GraphQL API                | We already store each title's AniList ID (`catalog.external_ids`, site `anilist`). One request can fetch up to 50 titles' covers (`Page(perPage: 50) { media(id_in: [...]) { id coverImage { large extraLarge } } }`). No key needed | 90 requests/min normally; **30/min while AniList says the API is degraded**; exceeding it means a 1-minute timeout | **Adopt** |
| Jikan (unofficial MyAnimeList API) | One request per title, by MAL ID; scrapes MyAnimeList                                                                                                                                                                                | 3 requests/s, 60/min, and MyAnimeList can rate-limit Jikan itself. A 48-card library page would take about 16 s    | Reject    |

Sources (opened or read through search results): https://docs.anilist.co/guide/rate-limiting (403 when opened; degraded 30/min limit quoted in search results) · https://anilist.gitbook.io/anilist-apiv2-docs/docs/guide/rate-limiting · https://docs.api.jikan.moe (limits quoted in search results) · https://docs.rs/crate/anilist_moe/latest/source/src/lib.rs (perPage cap of 50).

## Options

1. **Look up on view, remember the result in `catalog.anime_images` (chosen):** the first time a title appears on someone's screen, the server asks AniList (in batches of up to 50) and stores the cover link in the images table 0008 built for this. Every later view reads the stored link with no API call. At 30 requests a minute, 50 titles each, that's up to 1,500 new titles a minute, and the request count falls as the cache fills.
2. **Look up on every view, keep nothing (Flovet's earlier preference, 2026-11-06):** no stored links, but every deck page and library page costs an AniList request. With a few users at once we pass 30 a minute, and posters fall back to the generated art. Our app cache (Next.js `use cache`) could hold results for a while, but a deck page's titles differ per user, so it would rarely hit.
3. **Jikan:** too slow for a grid (see the table above).

## Decision

Option 1.

1. **Only titles on screen.** Posters are looked up for the cards a page is about to show: the deck's current page of 10 (spec 05 prefetch included) and the library's page of 48. Never in the weekly catalog import, never in a background crawl of the whole catalog.
2. **Server-side, batched.** A server-only function takes a page's anime IDs, reads stored links, and asks AniList once (up to 50 IDs) for the rest. The browser never calls AniList; it loads the image itself from `s4.anilist.co`, the host 0008 already locks for AniList.
3. **Stored as links only, no image files.** The `extraLarge` cover link goes into `catalog.anime_images` (source `anilist`), as 0008 designed. Titles AniList has no cover for are remembered too, so they aren't asked again for 30 days.
4. **Ranking unchanged.** In-house (10) and TMDB (20) still win when present; AniList (30) is switched on.
5. **Fails soft.** If AniList is slow (over 1.5 s), rate-limits us or errors, the page renders with the generated posters and tries again on a later view. A rate-limit response pauses all lookups for one minute.
6. **Credit.** "Cover images: AniList" joins the dataset credit, as 0008's `image_sources` row already says.

## Consequences

- **`CLAUDE.md` and the brief change** (with this approval): the "never call an external anime API" rule gets one exception: AniList's API, only for cover images of titles on screen, as this decision describes. Every other API (Jikan, MyAnimeList, Kitsu, TMDB's API, and AniList for anything else) stays forbidden.
- **Schema change:** a migration to switch the AniList source on and add a "looked up, no cover" marker with a date. Writes go through one `security definer` database function that accepts only `https://s4.anilist.co/` links for existing anime, called from the server, so no service-role key or new environment variable is needed.
- **Reverses Flovet's 2026-11-06 choice** not to store links. Option 2 keeps that choice at the cost of fallback posters under load.
- Reviews check: no AniList call from the browser or the import; one request per page at most; requests stop for a minute after a 429; the deck and library still render when AniList is down.
