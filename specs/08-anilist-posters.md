# 08: AniList posters for titles on screen

Status: Ready (decision 0017 approved) · Written: 2026-11-07

Brief: Data sources and licences (images, decision 0017) and the design direction's "artwork leads".

## Goal

Show real cover art instead of generated posters. When a page is about to show titles, the server looks up the covers it doesn't know yet from AniList in one batched request, remembers the links, and the cards load the images from AniList's image host. If AniList can't help, the generated poster stays.

## Decisions

Implements [0017](../docs/decisions/0017-anilist-posters-on-view.md), which replaces items 5 and 6 of [0008](../docs/decisions/0008-artwork-source.md). Follows the rest of 0008 (ranked sources, locked hosts, fallback chain) and [0004](../docs/decisions/0004-placeholder-poster-art.md).

## Acceptance criteria

### Database (new migration; approved through 0017)

1. The `anilist` image source is switched on (priority 30, prefix `https://s4.anilist.co/` unchanged).
2. A way to remember "looked up, no cover" per anime with the date, so those titles aren't asked again for 30 days.
3. `catalog.record_anilist_covers(jsonb)`: `security definer`, `set search_path = ''`, executable by `authenticated` only. Takes a list of `{anime_id, url}` (url may be null for "no cover"); accepts only existing, non-retired anime and URLs starting with `https://s4.anilist.co/file/anilistcdn/media/anime/cover/` (any signed-in user can call it, so it accepts nothing but an AniList anime cover); upserts one poster row per anime from source `anilist`; never touches other sources' rows. At most 50 items per call.
4. Database tests: bad host refused; other sources untouched; `anon` can't call it; a disabled source still hides its rows (0008).

### Server lookup

5. `getPosterSources(ids)` (server-only) returns stored candidates as today, and for ids with no AniList row and no recent "no cover" mark it:
   - finds their AniList ids in `catalog.external_ids` (site `anilist`),
   - sends **one** GraphQL request to `https://graphql.anilist.co` for up to 50 ids (`Page(perPage: 50) { media(id_in: [...], type: ANIME) { id coverImage { extraLarge large } } }`),
   - records the results with `record_anilist_covers` and includes them in what it returns.
6. Time limit 1.5 s; on timeout, error or a non-2xx response the page renders with what it has (generated posters for the rest). On a 429, no lookups at all for 60 s (per server instance), honouring `Retry-After` when present.
7. Responses are validated with zod; only `s4.anilist.co` URLs are kept.
8. Lookups happen only for titles a page is about to show: the deck page (including its prefetch) and the library page. The catalog import, the home page collage and any other code never call AniList.
9. No AniList call from the browser. `next.config` allows images from `s4.anilist.co` only if the project uses `next/image` for posters; `PosterArt` keeps trying candidates in order and falls back to the generated poster.

### Credit

10. "Cover images: AniList" appears with the dataset credit wherever that credit is shown.

### Tests

11. Unit tests with a mocked `fetch`: one request for many ids; ids without an AniList mapping are skipped; stored covers aren't fetched again; "no cover" is remembered; a timeout, a 500 and a 429 all return the stored candidates without throwing, and the 429 pauses later lookups.
12. E2E: the deck shows at least one poster image from `s4.anilist.co` (or, if AniList is unreachable from the test environment, the generated poster with no errors); no browser request goes to `graphql.anilist.co`.

## Out of scope

- In-house uploads and TMDB links (0008, separate work).
- Banner images, character or staff images, any other AniList data.
- Downloading or hosting image files.
- Looking up covers for the whole catalog in the background.

## Edge cases

- A title with no AniList id: generated poster, no request.
- AniList returns fewer media than asked: the missing ones get the "no cover" mark only if AniList answered successfully.
- Two requests for the same new titles at once (two users): both may look up; the upsert keeps one row.
- AniList changes a cover URL: the stored link may break; `PosterArt` falls back. Refreshing stale links is a later decision.
- Adult titles: still blurred until revealed (0010), whatever the source.

## Files and patterns to follow

- `src/features/posters/queries.ts` (`getPosterSources`) and its tests; a new `src/features/posters/anilist.ts` for the request.
- Migration style as in `20261106120000_anime_images.sql`.
- Read `node_modules/next/dist/docs/` for `fetch` and caching in this Next.js version before writing code (AGENTS.md).

## Boundaries

- **Always:** server-side only; one request per page at most; fail soft.
- **Ask first:** any dependency (use `fetch` and zod, already installed); any new environment variable.
- **Never:** call any API other than AniList's GraphQL endpoint for covers; call it from the browser or the import; store image files; edit an applied migration.

## Check

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm build` pass.
- Screenshots of the deck at 390 px and 1440 px with real covers, and the network log showing one GraphQL request for a fresh page and none on reload.
- Workflow E review against this spec and 0004, 0008 and 0017, posted on the PR.
