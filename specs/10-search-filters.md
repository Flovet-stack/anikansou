# 10: Search filters

Status: Blocked (needs decision 0020 approved) · Written: 2026-11-08

Brief: Must have #11 (advanced search), the genre/tags, year and format parts, plus season, status and sort. Studio comes later (0020).

## Goal

A fan on **Discover** narrows results by type, genre, year, status and season, and picks a sort, with or without typing a title. So they can find "fall 2023 action TV anime" without knowing a name, and share the link.

## Decisions

Implements [0020](../docs/decisions/0020-search-filters.md). Builds on [0018](../docs/decisions/0018-title-search.md) and [0019](../docs/decisions/0019-short-search-queries.md). Follows [0006](../docs/decisions/0006-title-card.md), [0007](../docs/decisions/0007-interaction-and-disclosure.md) and [0010](../docs/decisions/0010-deck-content-and-order.md).

## Acceptance criteria

### Database (new migration; approved through 0020)

1. `catalog.genre_tag_names(key)` returns the tag names for each key in 0020's list, and null for an unknown key. No API grants.
2. `search_anime` replaces the old signature (dropped in the same migration) with optional arguments: query, types, genres, year from, year to, season, status, sort, offset, limit. Same security model, result columns, page size and 200 cap as today. It rejects unknown genres, types, seasons, statuses and sorts, and a season without a single year.
3. It needs at least 2 letters or digits in the query, or at least one filter. Types match any; genres match all. A genre's tags resolve to ids first, then intersect (0020's measured plan).
4. Sorts follow 0020, tie-broken on anime id, so pages never repeat or skip a title. Best match without a query orders by the private score and never returns it.
5. `EXPLAIN ANALYZE` in the PR, under 150 ms, for: `action` + `comedy`; `sci-fi` alone; TV + 2023 + fall; Upcoming; Newest with no other filter except type; a query plus two genres. Add an index only if a plan needs it, and say why.

### Controls

6. Desktop (≥ 768 px): Type, Genre, Year and More filters (Status, Season) in one row under the field. Each opens a menu styled with project tokens, and results update after 250 ms. No Filter button.
7. Phones (< 768 px): one `Filters` button, with `· N` when filters are on, opens a bottom sheet of chips with Clear all and Show results. Results and the URL change only on Show results; closing without it discards the changes.
8. Season is disabled, with a hint, until a single year is chosen. Choosing a decade or clearing the year clears the season.
9. Year lists each year from the catalog's latest down to 2000, then the decades in 0020. Genre shows the two groups in 0020.
10. Sort menu above the results: Best match, Newest, Oldest, Title (A–Z).
11. Active filters show as removable chips, then Clear filters, which keeps the query. Clear search (0018) keeps the filters.

### URL

12. `q`, `type`, `genre`, `year`, `season`, `status` and `sort` live in the URL with `replaceState`, in 0020's format. A filtered link renders its results on first load, and survives reload and the log-in round trip. Unknown values are dropped, not errors. Any `q` or filter URL is `noindex`.

### Results and states

13. Filters work with an empty field. With no query and no filter, 0018's empty state stays.
14. Count text as in 0020, in the heading and the live region, once per settled search. At the 200 cap, the "Showing the first 200" line shows under the grid.
15. No results with a filter on: 0020's message and Clear filters. With a query and no filter: 0018's message.
16. A late reply never overwrites a newer search, across filter, sort and query changes. Show more keeps the current filters and sort.
17. Cards, the edit sheet, signed-out flow, adult blur and unaired rules work exactly as in spec 09.

### Accessibility

18. Menus and the sheet work by keyboard, with visible focus; Esc closes and returns focus to the control. Checked items expose their state. Each chip's remove button is named (`Remove filter: TV`). 44 × 44 px targets on touch.

### Tests

19. Database tests:
    - each filter alone and combined; any within Type, all within Genre
    - `sci-fi` matches each of its four tags
    - missing values appear only when their filter is off
    - each sort gives stable pages; retired titles are skipped
    - no score in the output; bad arguments are rejected
    - a query plus filters, including a 0019 short query
20. Unit tests: URL parsing and building (round trip, unknown values dropped, decades to a year range), season rules, count text with and without a query, chip labels. A test checks that the code's genre keys match the database's.
21. Component tests: the debounce and stale-reply guard across filter changes; the phone sheet applies only on Show results; Clear filters keeps the query.
22. E2E (desktop and 390 px touch), signed out unless noted:
    - genre + year narrow results, and the URL updates
    - a reload keeps them
    - removing a chip widens results
    - an impossible combination shows the no-results state, and Clear filters recovers
    - a query plus a filter
    - signed in: watchlist a filtered result and undo it

## Out of scope

- Studio filter, raw tag search, counts beside values, saved filters, an NSFW setting.
- Rating, language, title or studio pages, charts on Discover.
- Any change to the importer or to catalog tables.

## Edge cases

- `?year=2023&season=fall&year=abc`: the first valid value wins; a season without a year is dropped.
- Upcoming anime with a future year: selectable. Undated anime show only when Year is off.
- Sort Newest with a query: sorted among matches only.
- Many genres selected: an empty result is a normal state, not an error.
- Anime with both `sci-fi` and `science fiction`: one card only.
- Filter changes while Show more is loading: the old page is dropped.
- Resizing across 768 px with the sheet open: nothing is lost.

## Files and patterns to follow

- Extend `src/features/search/`; put filter parsing and building in one module, and keep `use-search.ts` as the single owner of state.
- Page: `src/app/(app)/discover/page.tsx`. Menus and the sheet use `@base-ui/react`, already installed, restyled like `SortMenu` and `EditSheet`.
- Regenerate `src/types/database.types.ts`.
- Read the Next.js docs in `node_modules/next/dist/docs/` before writing code (AGENTS.md).

## Boundaries

- **Always:** project tokens; no score anywhere, including the URL; every filter shareable.
- **Ask first:** any dependency; any table or index beyond this spec; any change to the genre list; applying the migration to Supabase.
- **Never:** call an external API or search service; edit an applied migration; add studio, rating or language "while you're there".

## Check

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm build` pass.
- `EXPLAIN ANALYZE` output for criterion 5 in the PR.
- Screenshots at 390 px and 1440 px (dark): the filter row and an open menu, the phone sheet, active chips with results, no results, the 200-cap line.
- Workflow E review against this spec and every decision it links, posted on the PR.
