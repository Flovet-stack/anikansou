# 07: Library

Status: Ready (decision 0016 approved; build after spec 06 is merged) · Written: 2026-11-07

Brief: the "record what they've watched" job, and Must have #3 (statuses), #4 (watchlist), #5 (rating) and #6 (like) as a page you can browse and edit.

## Goal

A signed-in fan opens **Library** and sees everything they've saved, on shelves: Watched, Watching, On hold, Dropped, Watchlist and Liked. They can sort it, change any title's status, rating, like or watchlist from the grid, and undo mistakes. This is also where Watching, On hold and Dropped are set, since the deck now offers Watched only.

## Decisions

Implements [0016](../docs/decisions/0016-library.md). Follows [0002](../docs/decisions/0002-app-shell-and-navigation.md) (the Library nav item ships with this spec), [0004](../docs/decisions/0004-placeholder-poster-art.md), [0005](../docs/decisions/0005-status-and-action-colours.md), [0006](../docs/decisions/0006-title-card.md) (the card and grid), [0007](../docs/decisions/0007-interaction-and-disclosure.md), [0011](../docs/decisions/0011-tracking-data-model.md) and [0015](../docs/decisions/0015-deck-watched-only.md) (rating needs Watched).

## Acceptance criteria

### Database (new migration; approved through 0016)

1. `library_page(shelf, sort, cursor, page_size)`: `security invoker`, `set search_path = ''`, `authenticated` only, page size 1–48. Shelves and sorts exactly as 0016 lists; a keyset cursor per sort so pages never repeat or skip a title when ties exist (tie-break on anime id). Returns the card fields 0006 needs (title, format, year, episodes, the user's status, rating, liked, watchlisted), never the aggregate score, and skips retired titles.
2. `library_counts()`: one row per shelf with its count, for the caller only.
3. `EXPLAIN ANALYZE` for a user with 2,000 tracked titles, first page and a later page, for each sort: under 50 ms, pasted in the PR. Add indexes only if the plans need them.

### Route and navigation

4. `/library` in the `(app)` shell, protected like `/rate` (proxy matcher and rules), disallowed in robots.
5. **Library** nav item second, after Rate, with a Hugeicons library or books icon from icons-animated (installed like the others, with the same two vendoring edits), animating on hover of the link (spec 06's hook).

### Shelves and grid

6. Link tabs with counts, `?shelf=` in the URL (default Watched). Watched, Watchlist and Liked always show; Watching, On hold and Dropped show only when they have titles. On phones the tab row scrolls and keeps the active tab in view. `aria-current="page"` on the active tab.
7. The 0006 grid and card: two columns under 600 px, `minmax(200px, 1fr)` from 600 px. Status badge and heart on the poster; the context line is the user's rating in stars when there is one.
8. Sort menu: Recently updated (default), Your rating, Title (A–Z), Year (newest first). The choice is in the URL (`?sort=`) and remembered in local storage.
9. 48 cards per page, then a "Show more" button that appends the next page and moves focus to the first new card.

### Editing

10. Pointer devices: the 0006 quick-action bar on hover or focus, with Watched, Like, Watchlist and ⋯. Touch: the ⋯ button only.
11. ⋯, and clicking the card (no title pages yet), opens the edit sheet: a dialog on pointer devices, a bottom sheet on touch. It has the four statuses (0005 colours and icons), the stars (enabled only when Watched, per 0015), like, watchlist and "Remove from library", which clears everything for that title in one action with one Undo.
12. Every save is optimistic, uses the spec 05 tracking actions, and shows an Undo toast; failures roll back with "Try again". Counts update with each change.
13. A title that no longer belongs on the current shelf after an edit stays in place, dimmed, until the toast closes, then leaves; Undo brings it back in place.

### States

14. Loading: skeleton cards in the grid. Empty shelves use 0016's copy with a "Start rating" button to `/rate`. Error: what happened and "Try again".

### Accessibility

15. Keyboard: tabs, sort, cards, quick actions and the sheet all work without a mouse; the sheet traps focus and returns it to the card on close; Esc closes it.
16. Each card's accessible name includes the title, and the rating and status when set. Saves are announced in a polite live region.

### Tests

17. Database tests: another user's titles never appear; each shelf returns the right titles; counts match; cursors give stable pages for every sort, with ties; retired titles are skipped.
18. Unit tests: shelf visibility rules, sort and cursor helpers, the "leaves the shelf after the toast" logic.
19. E2E (desktop and 390 px touch): rate and watchlist titles in the deck, open Library and find them on the right shelves with counts; change a title to Dropped from the sheet and see it move; remove one and undo; sort by rating; "Show more" works; a new user sees the empty state.

## Out of scope

- The public profile, other users' libraries, privacy settings.
- Title pages, search, filters other than shelves, lists, diary and dates, episode progress, reviews, stats.
- Poster images beyond what `getPosterSources` returns today (spec 08 adds AniList).

## Edge cases

- Thousands of titles: paging only, never loading the whole library.
- A title retired by an import: it disappears from the library; its tracking data stays in the database.
- A title both liked and watched appears on both shelves.
- Two tabs: an edit in one shows in the other after a reload; a stale edit is harmless.
- Very long titles: 2-line clamp, full title in the accessible name.

## Files and patterns to follow

- Feature folder `src/features/library/` (queries, actions, components), following `src/features/deck/`.
- Page `src/app/(app)/library/page.tsx`, like `rate/page.tsx` (Suspense and `connection()`).
- Reuse `PosterArt`, `getPosterSources`, `RatingStars`, `StatusPicker`, `ToggleAction` and the tracking actions; move shared pieces to a shared folder rather than copying them.
- Read the Next.js docs in `node_modules/next/dist/docs/` before writing code (AGENTS.md).

## Boundaries

- **Always:** tokens and 0005 colours only for their meanings; every action undoable; no score anywhere.
- **Ask first:** any dependency (a dialog or sheet primitive beyond what the project has); any schema change beyond the two functions and indexes.
- **Never:** call an external API; edit an applied migration; streaks, goals or guilt copy.

## Check

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm build` pass.
- `EXPLAIN ANALYZE` output in the PR.
- Screenshots at 390 px and 1440 px (dark): a full shelf, the empty state, the edit sheet, the quick-action bar.
- Workflow E review against this spec and 0002, 0004–0007, 0011, 0015 and 0016, posted on the PR.
