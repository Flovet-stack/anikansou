# 0008: Poster sources: in-house, TMDB, AniList, then generated

- **Status:** Approved; items 5 and 6 (no external calls, AniList off) are superseded by [0017](0017-anilist-posters-on-view.md)
- **Proposed:** 2026-11-06 by the product team (roles: Product, Tech Lead, Backend, Database, Frontend)
- **Approved:** 2026-11-06 by Flovet ("Let's implement it for now in this order")
- **Specs:** specs/03-poster-sources.md

## Context

Flovet wants real artwork on every title, with the generated poster ([0004](0004-placeholder-poster-art.md)) only when nothing else is available, and proposed a posters table where "each poster can reference multiple sources and display the first available source", fed by an in-house library, TMDB and AniList.

Constraints found while researching (2026-11-06):

1. **AniList's API terms** prohibit use "within competing noncomplementary services of the same nature" (list/tracker services) and "hoarding or mass collection of data". Competing services "may be authorized on request" when they integrate with AniList's API and accounts, which is Flovet's plan. Storing only links, or fetching them at render time, still uses the API inside a tracker, so AniList needs written permission first.
2. **TMDB** is a film and TV database, not a competing tracker. Its API and images are free for non-commercial use with attribution ("This product uses the TMDB API but is not endorsed or certified by TMDB", plus a TMDB logo in an About or Credits section); commercial use needs a written agreement. Letterboxd sources its posters from TMDB.
3. **Our dataset has no TMDB IDs**, so TMDB links are added by hand for now.
4. **Cover art belongs to its rights holders** whatever the source. The brief's legal check before monetizing still applies.
5. **Looking images up during the catalog import** would slow it and make it fail when another service is down.

## Research

| Source                              | Terms for a tracker like ours                                 | Cost                                                       | Decision                                        |
| ----------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| In-house (our own Supabase Storage) | Ours to host; artwork rights still belong to the studios      | Storage only                                               | Adopt, highest priority                         |
| TMDB                                | Allowed, non-commercial, with attribution                     | Free until commercial                                      | Adopt, links added by hand                      |
| AniList                             | Excluded as a competing tracker unless AniList authorises it  | Free under $150/month revenue                              | Adopt **switched off** until written permission |
| TheTVDB                             | Negotiated licence                                            | Third-party figures: free under $50k revenue (unconfirmed) | Not now                                         |
| MyAnimeList API, Jikan              | Commercial use needs written authorisation; Jikan scrapes MAL | —                                                          | Reject                                          |
| Kitsu, Fanart.tv                    | No terms found                                                | —                                                          | Reject for now                                  |

Sources (opened): https://anilist.gitbook.io/anilist-apiv2-docs/docs/guide/terms-of-use · https://developer.themoviedb.org/docs/faq · https://myanimelist.net/static/apiagreement.html · https://github.com/manami-project/anime-offline-database (search summary: dataset `picture` links point to MyAnimeList's CDN). Seen in search results: https://themoviedb.org:443/api-terms-of-use · https://www.themoviedb.org/talk/685d2476cec9a0e2ff80546e?page=1 (Letterboxd uses TMDB images) · https://github.com/thetvdb/v4-api.

## Options

1. **One image column per anime:** simple, but one source only and no fallback chain.
2. **A table of images with several sources, ranked (chosen).**
3. **Look images up in the catalog import:** rejected (slow, fragile).

## Decision

1. **A separate image table, not part of the catalog import.** `catalog.anime_images` holds one row per anime, image kind (poster for now) and source: a link (external sources) or a Storage path (in-house). The weekly catalog import never reads or writes it.
2. **Ranked sources with an on/off switch.** `catalog.image_sources` lists each source with a priority and `is_enabled`. Order: **in-house (10) → TMDB (20) → AniList (30, off)**. Turning a source off hides all its images at once, enforced by RLS.
3. **Hosts are locked per source.** Each source has a URL prefix (TMDB: `https://image.tmdb.org/t/p/`, AniList: `https://s4.anilist.co/`); the database refuses a link that doesn't start with its source's prefix, so no other host can be hotlinked by mistake.
4. **Readers get candidates in order.** A view lists the usable images per anime, best first. The poster component (built with the design foundations) tries them in order and falls back to the generated poster if none loads.
5. **No external calls in this step.** In-house images are uploaded by hand; TMDB links are pasted by hand. A job that looks up TMDB IDs, or anything that calls AniList, needs its own decision and spec.
6. **AniList** stays off until AniList grants written permission (Flovet to email contact@anilist.co). Turning it on is a new decision that records their reply.
7. **Attribution:** TMDB's notice and logo go on the About/Credits page when the first TMDB image is shown (in the spec that shows posters).

## Consequences

- `PROJECT_BRIEF.md` changes: image links recorded in `catalog.anime_images` may be shown. `CLAUDE.md` stays as it is, because nothing here calls an API: calling TMDB's or AniList's API is still forbidden, and doing so later needs its own decision.
- Adds a migration (two tables, a view, a trigger, RLS) and a public Storage bucket `posters` (created by Flovet).
- Free-plan database size: one row per image is small; the images themselves live in Storage or on the source's CDN.
- Reviews check: no image link outside its source's prefix; disabled sources return no rows to `anon`; the catalog import is untouched.
