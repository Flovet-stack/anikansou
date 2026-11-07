# 09: Title search

Status: In progress (branch claude/title-search) · Written: 2026-11-07

Brief: Must have #11 (advanced search), the "title in any language" part. Filters come later.

## Goal

Anyone, signed in or not, opens **Discover**, types part of an anime's title in English, romaji or Japanese, and sees matching titles as poster cards while they type. Signed-in fans can then save, rate or watchlist a result right there, so they can log a show without waiting for the deck to deal it.

## Decisions

Implements [0018](../docs/decisions/0018-title-search.md). Follows [0002](../docs/decisions/0002-app-shell-and-navigation.md) (the Discover nav item ships with this spec), [0003](../docs/decisions/0003-icon-set.md), [0004](../docs/decisions/0004-placeholder-poster-art.md), [0005](../docs/decisions/0005-status-and-action-colours.md), [0006](../docs/decisions/0006-title-card.md) (card, grid and the search context line), [0007](../docs/decisions/0007-interaction-and-disclosure.md), [0008](../docs/decisions/0008-artwork-source.md), [0010](../docs/decisions/0010-deck-content-and-order.md) (adult and unaired titles), [0015](../docs/decisions/0015-deck-watched-only.md) and [0016](../docs/decisions/0016-library.md) (the edit sheet).

## Acceptance criteria

### Database (new migration; approved through 0018)

1. `search_anime(p_query, p_offset, p_limit)`: `security definer`, `set search_path = ''`, executable by `anon` and `authenticated`, page size 1–24, offset up to 200. Rejects queries under 2 or over 100 characters after trimming. Normalizes the query the way the importer builds `search_text`, and matches with `word_similarity` on the existing trigram index.
2. Returns one row per anime: id, shown title, format, year, episodes, airing status, adult flag, the matched title when it isn't the shown one, the caller's own status, rating, liked and watchlisted (null when signed out), and a total capped at 201. Never returns the aggregate score or any similarity value. Skips retired anime.
3. Ranking follows 0018. With the live catalog these hold, as database tests:
   - `one piece` → One Piece (the TV series) first
   - `attack on titan`, `aot` and `進撃の巨人` → Shingeki no Kyojin (season 1) first
   - `frieren` and `frieren beyond journeys end` → Sousou no Frieren (season 1) in the top 2
   - `bebop` → Cowboy Bebop first
   - `k-on` → K-On! first
4. `EXPLAIN ANALYZE` for each query above shows a Bitmap Index Scan on `anime_titles_search_trgm_idx` and under 150 ms execution time. Paste it in the PR.

### Route and navigation

5. `/discover` in the `(app)` shell, public (not in the proxy's protected list). `?q=` pages send `noindex` metadata.
6. **Discover** nav item third, after Rate and Library, with the Hugeicons search icon from icons-animated (installed like the others), animating on hover of the link (spec 06's hook). `aria-current="page"` when active.

### Search field

7. `role="search"` landmark, `type="search"` input with a visible "Search anime" label, the 0018 placeholder, and a clear button with an accessible name.
8. Searches 250 ms after the last keystroke from 2 characters; Enter searches at once; Esc clears. Below 2 characters no request is sent. A late response never overwrites a newer query's results.
9. The query lives in `?q=` and updates with `replace`. Opening `/discover?q=frieren` directly shows the results on first load (server-rendered). Autofocus only on pointer devices with no query.

### Results

10. Above the grid: `N results for "query"`, or `200+ results` at the cap. The same text goes to a polite live region once per settled search.
11. The 0006 grid and `TitleCard` with the meta line, plus `Also known as …` as the context line when the match was on another title.
12. 24 cards, then **Show more** up to 200; focus moves to the first new card.
13. Adult titles: 18+ badge and blurred poster as in the deck. Unaired titles: no rating or Watched control, in the card and in the sheet.
14. Signed in: the 0006 status badge and heart, the quick-action bar (pointer) or ⋯ (touch), and a card click opens spec 07's edit sheet. Saves are optimistic with Undo, through the existing tracking actions; the card updates in place.
15. Signed out: no quick actions or ⋯. A card click goes to log in with a return to the same `/discover?q=…`.

### States

16. Empty field, 1 character, loading (first-time skeletons; later, old results dimmed), no results and error: exactly as 0018's table, with its copy.

### Accessibility

17. Keyboard only: Tab from the field reaches the clear button, the results count, then the cards; everything in the card and sheet works without a mouse. Visible focus everywhere.
18. Each card's accessible name has the title and, when set, your status and rating. The live region never announces per keystroke.

### Tests

19. Database tests: criteria 1–3, including another user's state never appearing, retired anime skipped, and the 2/100-character limits.
20. Unit tests: query normalization matches the importer's on Latin, accented and Japanese samples; the debounce and stale-response guard; the results-count text, including `200+`.
21. E2E (desktop and 390 px touch): signed out, search `frieren` and see Sousou no Frieren, click it and land on log in, return to the search after logging in; signed in, search, watchlist a result and see the badge, undo it; a 1-character query sends no request; `zzzzqqq` shows the no-results state and Clear search empties the field; Japanese query `葬送` finds Sousou no Frieren; reload keeps the query.

## Out of scope

- Filters (genre/tags, studio, year, format), sorting, title pages, studio pages.
- An autocomplete dropdown, recent searches, "did you mean", typo correction for swapped letters (0018 records the gap).
- Charts or anything else on Discover besides search.
- Title-language toggle, the NSFW setting, new poster logic (posters come from the existing component; spec 08 adds AniList covers wherever it ships).
- Any change to `catalog` tables, the importer or the trigram index.

## Edge cases

- Queries made of punctuation or spaces only (`!!`, `  `): treated as empty after normalization, no request.
- Very short Latin words that match hundreds of titles (`k-on`): the cap holds and ranking still puts the exact title first.
- The same title on several entries (199 shared main titles, spec 01): every entry shows, and the meta line tells them apart.
- Mixed scripts and full-width characters (`ＫＯＮ`): NFKC makes them match.
- A query pasted with a trailing newline or 500 characters: trimmed, and over 100 characters it's cut to 100 in the field.
- Rapid typing on a slow connection: only the latest query's results show.

## Files and patterns to follow

- Feature folder `src/features/search/` (query, normalization, components), following `src/features/deck/` and spec 07's `src/features/library/`.
- Page `src/app/(app)/discover/page.tsx`, like `rate/page.tsx` (Suspense and `connection()`), with the search params read as the installed Next.js docs say.
- Reuse `TitleCard`, `PosterArt`, `getPosterSources`, the edit sheet and the tracking actions. Don't copy them.
- Read the Next.js docs in `node_modules/next/dist/docs/` before writing code (AGENTS.md).

## Boundaries

- **Always:** one function, no new tables or indexes; tokens and 0005 colours only for their meanings; every save undoable; no score anywhere.
- **Ask first:** any dependency (a debounce or search library is not needed); any schema change beyond the function and its grants; any change to the threshold that makes a criterion-3 query rank differently.
- **Never:** call an external API or search service; edit an applied migration; send a request per keystroke without the debounce; streaks, goals or guilt copy.

## Check

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm build` pass.
- `EXPLAIN ANALYZE` output for the criterion-3 queries in the PR.
- Screenshots at 390 px and 1440 px (dark): results for `frieren` signed in and signed out, the `Also known as` line, no results, the empty field, the quick-action bar.
- Workflow E review against this spec and every decision it links, posted on the PR.
