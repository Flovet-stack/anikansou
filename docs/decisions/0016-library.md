# 0016: Library: your saved anime, by shelf

- **Status:** Approved
- **Proposed:** 2026-11-07 by the product team (roles: Product, UX, UI, Copy, Database, Frontend, Gamification)
- **Approved:** 2026-11-07 by Flovet ("Approve all three")
- **Specs:** specs/07-library.md

## Context

The deck (spec 05) saves ratings, statuses, likes and the watchlist, but nothing shows them back. The brief's core loop is "rate, set status, add to watchlist, like; then review, list, share and track progress over time", and its main job is "record what they've watched and what they thought of it". 0002 plans **Library** as a top-level section. Flovet chose it as the next spec (2026-11-07).

Out of this decision (later specs): the public profile and its "Currently watching" and top 4 (brief 13, 14), episode progress (7), dates and the diary (9), lists (15), title pages, search (11).

## Research

| Reference                                                                     | What they do                                                                                                                                     | Adopt / adapt / reject              | Why                                                                                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Letterboxd profile (team knowledge; help pages returned 403)                  | Separate Films (watched), Diary, Watchlist and Likes pages; poster grid; your rating under each poster; sort by date, rating, release year, name | Adapt                               | Poster grid with your rating is exactly 0006's "your lists" context line; separate shelves for watchlist and likes |
| AniList and MyAnimeList lists (team knowledge; search found no official docs) | One list split by status (Watching, Completed, Paused, Dropped, Planning) with counts; grid or table view; sort                                  | Adopt shelves by status with counts | Anime fans expect status shelves; our statuses map 1:1, Watchlist = Planning                                       |
| NN/g, "Tabs, used right" (opened)                                             | Tabs for clear groupings, few of them, 1–2 word labels                                                                                           | Adopt                               | Six short shelf labels; each shelf is a view, not a filter, so tabs (links) fit                                    |
| NN/g / UXtweak on sorting vs filtering (search summary)                       | Sorting is a separate control from narrowing                                                                                                     | Adopt                               | One sort menu; no filter panel while collections are small                                                         |
| Our 0006 title card                                                           | Quick actions on hover/focus, ⋯ sheet on touch with status and rating                                                                            | Adopt as is                         | The library is the first page that uses the full card                                                              |

Sources (opened): https://www.nngroup.com/articles/tabs-used-right/ . Seen in search results only: https://blog.uxtweak.com/fr/filter-vs-facet/ · https://myanimelist.net/animelist/Tabe (MAL list layout). Letterboxd's FAQ and help search returned nothing useful or 403; its layout is from team knowledge and marked as such.

## Options

1. **One page, shelves as link tabs, poster grid, sort menu (chosen).**
2. **One mixed list with filter chips** (status, liked, watchlist): flexible, but a title can sit on several shelves (Watched and Liked), so chips combine confusingly; more to build.
3. **Separate top-level pages** for Watchlist and Likes, Letterboxd-style: more nav items than 0002's limit of five.

## Decision

Option 1.

### Page and access

- **`/library`**, signed-in only (redirects like `/rate`), private to you for now. The public profile is a later spec.
- **Library** nav item (0002), second after Rate, with the Hugeicons library/books icon.

### Shelves (link tabs, `?shelf=`)

| Shelf             | Contains        | Shown when    |
| ----------------- | --------------- | ------------- |
| Watched (default) | status Watched  | always        |
| Watching          | status Watching | it has titles |
| On hold           | status On hold  | it has titles |
| Dropped           | status Dropped  | it has titles |
| Watchlist         | watchlisted     | always        |
| Liked             | liked           | always        |

- Each tab shows its count (`Watched 128`). Shelves with no titles are hidden except the three always-shown ones, so a new user sees three tabs, not six empty ones.
- Tabs scroll horizontally on phones; the active one stays in view.

### Grid and cards

- 0006 grid and card: two columns on phones, `minmax(200px, 1fr)` from 600 px.
- Context line: **your rating in stars** (Watched shelf, and wherever a rating exists); nothing on unrated cards.
- Status badge and heart on the poster as 0006 says.
- **Card click:** there are no title pages yet, so clicking the card opens the edit sheet (below). When title pages ship, the click goes there and the sheet stays on ⋯.

### Editing

- 0006 quick actions: hover/focus bar with Watched, Like, Watchlist and ⋯ on pointer devices; ⋯ on touch.
- ⋯ opens a sheet (dialog on desktop, bottom sheet on touch) with all four statuses, the stars (enabled only for Watched, per [0015](0015-deck-watched-only.md)), like and watchlist, plus "Remove from library" (clears everything for that title).
- Saves are optimistic with an Undo toast, reusing the tracking functions and `deck_undo` from spec 05.
- A title that leaves the shelf after an edit (e.g. moved from Watched to Dropped) fades out after the toast, so Undo can bring it back in place.

### Sort

One menu: **Recently updated** (default), **Your rating** (high to low, unrated last), **Title (A–Z)**, **Year (newest first)**. Remembered per user in local storage.

### Loading

- 48 cards per page with a "Show more" button (keyboard and screen-reader friendly; no infinite scroll so the footer and dataset credit stay reachable).
- One database function returns a page of a shelf with a keyset cursor for each sort, plus the shelf counts, running as the caller (`security invoker`, RLS). Under 50 ms at 2,000 tracked titles (`EXPLAIN ANALYZE` in the PR).

### States

- **Loading:** skeleton cards.
- **Empty Watched:** "Nothing here yet. Rate a few anime and they'll show up here." with a "Start rating" button to `/rate`.
- **Empty Watchlist / Liked:** one line on how to add (swipe up or the bookmark; the heart), same button.
- **Error:** what happened and "Try again".

### Gamification

None new. Counts are plain numbers, never goals or streaks.

## Consequences

- New migration: the library page function (and indexes if `EXPLAIN` needs them). No new tables; RLS from 0011 already covers reads.
- Ratings stay Watched-only everywhere (0015), so a Dropped title can't be rated. Trade-off: Letterboxd lets you rate anything you logged; we keep one rule for both pages, as Flovet asked.
- The edit sheet becomes a shared component that title pages reuse later.
- Reviews check: counts match the shelves; shelves hide when empty except the three; sort keeps a stable order across pages; edits and undo work from the grid and the sheet; keyboard and screen-reader use; 390 px and 1440 px screenshots.
