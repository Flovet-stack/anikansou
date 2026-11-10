# 0020: Search filters on Discover

- **Status:** Approved
- **Proposed:** 2026-11-08 by the product team (roles: Tech Lead, PM, Database, Product, UX, UI, Copy, Frontend, Backend)
- **Approved:** 2026-11-08 by Flovet (merged PR #20, then "can you implement spec-10 now?")
- **Specs:** specs/10-search-filters.md

## Context

Flovet (2026-11-08) shared a screenshot of a competing site's filter bar and asked for similar filters. Brief, Must have #11: "Advanced search (title in any language, genre/tags, studio, year, format)". 0018 shipped the title part and left filters for their own decision, "under the field on the same page".

Out of this decision: studio filter (see below), the NSFW setting (#23), title and studio pages, charts on Discover (#25), hidden gems (#33).

## Research

| Reference                                          | What they do                                                                                                                                | Adopt / adapt / reject | Why                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| Flovet's screenshot (all-wish.me)                  | Two rows of always-visible dropdowns: Search, Type, Genre, Year, Rating, Status, All, Season, Language, Default (sort), and a Filter button | Adapt                  | The right kinds of filter, but 11 controls is heavy, and Rating and Language have no data here |
| AniList browse (team knowledge; page returned 403) | Search, Genres, Year, Season, Format in one row, the rest behind an advanced toggle; active filters show as removable tags                  | Adopt                  | A few visible filters, the rest disclosed, fits 0007                                           |
| Letterboxd films browse (team knowledge)           | Year or decade, genre and sort in compact menus; decades for older films                                                                    | Adopt decades          | 124 years don't fit a useful flat list                                                         |
| NN/g, "Filter Categories and Values" (opened)      | Concrete labels, no jargon, broad categories first, order numbers logically and known names alphabetically                                  | Adopt                  | Genre labels and control order                                                                 |
| NN/g, "Applying Filters" (opened)                  | Instant results suit fast sites and exploring; on phones, batch with an Apply button, because repeated loads add effort                     | Adopt                  | Instant on desktop, **Show results** in the phone sheet                                        |

Live catalog probe (read-only, 2026-11-08, 38,337 active anime):

| Filter              | What the data allows                                                                                                               | Result               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Type                | 99.7% filled; TV 9,692, Special 11,020, Movie 6,485, ONA 6,348, OVA 4,676                                                          | Works                |
| Year                | 96.6% filled; 1907 to 2030                                                                                                         | Works                |
| Season              | 85.0% filled                                                                                                                       | Works with a year    |
| Status              | 99.7% filled; finished 36,664, upcoming 1,051, ongoing 521                                                                         | Works                |
| Genre               | 3,139 raw tags, many noisy (`present`, `earth`, `tropes`) or duplicated (`sci-fi`, `science fiction`, `sci fi`, `science-fiction`) | Needs a curated list |
| Studio              | 6,523 rows, all lowercase, split duplicates (`j.c.staff co., ltd.` and `j.c. staff`)                                               | Needs cleanup first  |
| Age rating, sub/dub | Not in the dataset                                                                                                                 | Not possible         |

Speed without a query: two genres joined by tag name took 389 ms. Resolving tag ids first and intersecting took 39 ms for the largest pair (`action` + `comedy`). Type, year and season took about 20 ms, without new indexes. Target stays 150 ms (0018).

Sources (opened): https://www.nngroup.com/articles/filter-categories-values/ · https://www.nngroup.com/articles/applying-filters/ . AniList returned 403; AniList and Letterboxd layouts are from team knowledge and marked as such.

## Options

1. **Curated filters, a few visible, the rest disclosed (chosen).**
2. **All dropdowns always visible, as in the screenshot.** Everything is one tap away, but it takes two rows on desktop and a full screen on phones, and it reads as generic, which the brief rules out.
3. **Sidebar with a count beside every value.** Helps avoid empty results (NN/g), but needs a count query per value, and takes the grid's width (0002 caps grids at 960 px). Revisit if empty results prove common.
4. **Every raw tag as a filter.** 3,139 noisy values. Rejected for now; tag search can come later.

## Decision

Option 1.

### Filters

| Filter     | Choice                               | Values                                                                                  |
| ---------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| **Type**   | Several, any of them                 | TV, Movie, OVA, ONA, Special                                                            |
| **Genre**  | Several, all of them                 | The curated list below                                                                  |
| **Year**   | One                                  | Each year from the catalog's latest down to 2000, then 1990s, 1980s, 1970s, Before 1970 |
| **Status** | One                                  | Airing, Finished, Upcoming                                                              |
| **Season** | One, enabled only with a single year | Winter, Spring, Summer, Fall                                                            |

**Sort** (one menu above the results): **Best match** (default), **Newest**, **Oldest**, **Title (A–Z)**.

- **Best match** with a query keeps the 0018 and 0019 order. Without a query it uses the dataset's aggregated score, internally only, as the deck does (brief: "never shown to users").
- Anime missing a value appear only when that filter is off. Under Newest and Oldest, undated titles come last.

### Curated genres

| Group    | Label → tags it covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Genres   | Action → `action`; Adventure → `adventure`; Comedy → `comedy`; Drama → `drama`; Fantasy → `fantasy`; Historical → `historical`; Horror → `horror`; Isekai → `isekai`; Mecha → `mecha`; Military → `military`; Music → `music`; Mystery → `mystery`; Psychological → `psychological`; Romance → `romance`; School → `school`, `school life`; Sci-Fi → `sci-fi`, `science fiction`, `sci fi`, `science-fiction`; Slice of life → `slice of life`, `slice-of-life`; Sports → `sports`; Supernatural → `supernatural`; Thriller → `thriller` |
| Audience | Shounen, Shoujo, Seinen, Josei → the same tag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Adult tags aren't offered as genres. The list lives in one small database function, so adding a genre is a one-line migration.

### Not included

- **Rating:** the dataset has no age ratings, and the aggregate score is never shown (brief).
- **Language (sub/dub):** no data.
- **Studio:** deferred, although the brief lists it. Filtering on today's rows would show lowercase names and split studios in two (J.C.Staff's titles under two entries). It needs a name cleanup, which studio pages (#12) need too, so it gets its own decision then. **#11 stays partly open until that ships.**

### Layout and behaviour

- **Desktop (≥ 768 px):** under the search field, one row: **Type**, **Genre**, **Year**, **More filters** (Status, Season), each opening a small menu. Results update right away (250 ms debounce). There's no Filter button.
- **Phones (< 768 px):** one **Filters** button with a count (`Filters · 2`), opening a bottom sheet with every group as tappable chips, **Clear all** and **Show results**. Results update only on Show results (NN/g), so this is the one place with an apply button.
- **Active filters:** removable chips under the controls (`TV ×`, `Action ×`), then **Clear filters**. Clearing filters keeps the query.
- **The URL** holds it all, and every search stays shareable: `/discover?q=gundam&type=tv,movie&genre=action,mecha&year=2023&season=fall&status=airing&sort=newest`. Unknown values are ignored. Any `?q=` or filter URL is `noindex`.

### Browsing without a query

Filters work with an empty field. Any filter or a query starts a search; with neither, the page keeps 0018's empty state. The cap of 200 results and Show more stay. At the cap, a line under the grid says: "Showing the first 200. Add a filter to narrow it down."

### States and content

- **Count:** `36 results for "gundam"`, or `36 results` with no query (`200+` at the cap). Announced through the same live region.
- **No results:** `No anime match these filters.` Below it, "Try removing a filter." and **Clear filters**. With a query, 0018's message stays when no filter is on.
- **Adult and unaired titles:** included, with the 0010 badge and blur. Adult titles aren't filtered out until the NSFW setting (#23) ships.

### Data

- One new migration, with no new tables or indexes unless `EXPLAIN` needs them:
  - `catalog.genre_tag_names(key)`: the curated list.
  - `search_anime` gains optional type, genre, year range, season, status and sort arguments. Its argument list changes, so the old function is dropped. Same security model as 0018.
- The query becomes optional: at least 2 letters or digits, or at least one filter. Genres resolve to tag ids first and intersect, as the probe measured.
- Target: under 150 ms for every filter combination.

### Gamification

None.

## Consequences

- Browsing by filter becomes possible without knowing a title, so Discover starts to live up to its name.
- A query and filters combine: a 3-letter query still uses 0019's prefix rule.
- Empty results are possible, because menus show no counts. The clear-filters path handles that.
- Reviews check:
  - every filter alone and combined, Any within Type and All within Genre
  - `sci-fi` finds titles under each of its four tags
  - no score in any response or URL, and sort keeps a stable order across pages
  - the phone sheet applies only on Show results
  - query survives clearing filters, and every filter survives reload and log-in
  - keyboard use of the menus; 390 px and 1440 px screenshots
