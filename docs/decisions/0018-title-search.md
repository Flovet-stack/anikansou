# 0018: Title search on Discover

- **Status:** Approved
- **Proposed:** 2026-11-07 by the product team (roles: Tech Lead, PM, Database, Product, UX, UI, Copy, Frontend, Backend)
- **Approved:** 2026-11-07 by Flovet ("Approve 0018")
- **Specs:** specs/09-title-search.md

## Context

Flovet (2026-11-07): "I want us to work on the next spec, that is the search page, that way I can search any anime." Today the only way to reach a title is the deck, so a fan can't look up a show they just finished and rate it.

Brief, Must have #11: "Advanced search (title in any language, genre/tags, studio, year, format)". The team splits it. This decision covers **title search**. Filters (genre/tags, studio, year, format) get their own decision and spec once title search ships, since each one adds UI, query and index work. 0002 already plans **Discover** as a top-level section, and 0006 already defines the search card's context line.

What we already have (spec 01): `catalog.anime_titles` holds every main title and synonym (262,487 rows, 105,935 with non-Latin characters), each with a `search_text` normalized by the importer (NFKC, lowercase, single spaces) and a `pg_trgm` GIN index on it. `lang` is empty: the dataset doesn't say which title is English, romaji or Japanese. Searching across all of them is what covers "title in any language".

Out of this decision: filters, title pages, studio pages, the title-language toggle (#10), charts on Discover (#25), the NSFW setting (#23), recent searches, and "did you mean" suggestions.

## Research

| Reference                                                                  | What they do                                                                                                                                                                 | Adopt / adapt / reject | Why                                                                                                                                         |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| X Explore (team knowledge)                                                 | The Explore tab has the search field at the top and trends below it. Search is part of a discovery section, not its own tab.                                                 | Adopt                  | Matches 0002's planned **Discover** section. Charts can join below the field later without adding a nav item.                               |
| Letterboxd search (team knowledge; scraper docs opened via search results) | A search icon in the header. Results come from an autocomplete endpoint, then a results page split by type (films, people, lists).                                           | Adapt                  | We have no header on desktop (0002 sidebar), and only one result type for now (anime). Keep a results page, skip the type tabs.             |
| Crunchyroll search (team knowledge)                                        | Search icon in the top bar, then a full-screen search. Results update as you type, as a poster grid with title and type.                                                     | Adopt                  | Poster grid that updates as you type fits "artwork leads" and the 0006 card.                                                                |
| Baymard, autocomplete design (opened)                                      | Up to 10 suggestions (4–8 on mobile), keyboard support (arrows, Enter), dim the page, no inner scroll                                                                        | Reject for v1          | A dropdown only helps when it leads to a page. We have no title pages yet, so the grid _is_ the destination. Revisit when title pages ship. |
| NN/g, search no-results page (opened)                                      | Say clearly that nothing matched, keep the query editable, give concrete next steps, no jokes                                                                                | Adopt                  | The no-results state below follows it.                                                                                                      |
| PostgreSQL docs, `pg_trgm` (opened)                                        | `word_similarity` (`<%`, default threshold 0.6) matches part of a longer title. GIN serves the filter but not ordering by distance. Non-alphanumeric characters are ignored. | Adopt                  | The existing index already serves `<%`. Ranking is done on the small matched set.                                                           |
| Our live catalog (read-only probe, 2026-11-07)                             | See the table below                                                                                                                                                          | Adopt with a known gap | Shows what works today and what doesn't.                                                                                                    |

Live probe (word similarity at the default 0.6, existing index, round trip from Flovet's machine):

| Query                         | Matches    | Top result                             | Note                                                                                                |
| ----------------------------- | ---------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `frieren`                     | many       | Sousou no Frieren titles               | Partial word works                                                                                  |
| `frieren beyond journeys end` | 6          | Sousou no Frieren                      | English synonym, punctuation dropped                                                                |
| `葬送` / `進撃の巨人`         | 37+        | Sousou no Frieren / Shingeki no Kyojin | Japanese works; pg_trgm makes trigrams from kana and kanji                                          |
| `attack on titan`, `aot`      | 41, 30     | Shingeki no Kyojin                     | Synonyms and abbreviations in the dataset work                                                      |
| `one piece`                   | 144        | "The One Piece" before "One Piece"     | Ties at 1.0 need a ranking rule                                                                     |
| `naurto`, `fireren`           | 0, 1 wrong | none                                   | **Swapped-letter typos fail.** At 0.4 the results are junk, so lowering the threshold doesn't help. |

Sources (opened): https://www.postgresql.org/docs/current/pgtrgm.html · https://www.nngroup.com/articles/search-no-results-serp/ · https://baymard.com/blog/autocomplete-design . Seen in search results only: https://apify.com/lulzasaur/letterboxd-scraper.md (Letterboxd's search runs on an autocomplete endpoint). Letterboxd, Crunchyroll and X layouts come from team knowledge and are marked as such.

## Options

1. **Title search on the existing trigram index, at `/discover` (chosen).** No new tables or indexes, one database function, one page. It handles every script, partial words and synonyms. It doesn't handle swapped-letter typos.
2. **Full-text search (`tsvector`)**, as spec 01 assumed. Stemming suits sentences, not names. It splits Japanese badly without an extension Supabase doesn't ship, and it adds a column and an index for no gain on titles. Rejected.
3. **Trigram plus a typo fallback** (`fuzzystrmatch` Levenshtein over a word list), used when the trigram search finds nothing. It fixes "naurto", but it needs a new word table, an import step and tuning. Deferred: a follow-up decision if real searches show typos are common.
4. **An external search service** (Algolia, Meilisearch, Typesense). Better typo tolerance, but it's a paid or extra hosted service, and the brief allows "no Redis" and no paid services. Rejected.

## Decision

Option 1.

### Page and navigation

- **`/discover`**, with the query in `?q=`. It's public: the catalog is readable by everyone (spec 01), so signed-out visitors can search too.
- **Discover** nav item (0002), placed after Rate and Library, with the Hugeicons search icon (0003). For now the page holds only search. Charts (#25) join it later, below the field.
- A `?q=` results page is `noindex` (thin, endless pages). `/discover` itself follows the site's normal robots rules.

### Search field

- At the top of the content column, inside a `role="search"` landmark. It's `type="search"` with a visible label ("Search anime"), placeholder `Title in English, romaji or Japanese`, and a clear button.
- **Results update as you type**, debounced 250 ms, from **2 characters** (after trimming). Enter searches at once. Esc clears the field.
- The URL updates with `replace` (not a new history entry per keystroke), so a search can be shared and reloaded, and Back leaves the page.
- Autofocus on desktop when the page opens with no query. No autofocus on touch screens (it opens the keyboard over the page).

### Matching and ranking

- The query gets the same normalization as `search_text` (NFKC, lowercase, single spaces). It matches **any title or synonym** with `word_similarity` at the default 0.6, on the existing index.
- One result per anime. Retired anime never appear (they redirect, per spec 01). Specials, unaired and adult titles are included, as in the deck (0010).
- Order: 1) the **main** title equals the query; 2) a synonym equals the query; 3) best word similarity; 4) the best match was on the main title; 5) the dataset's aggregated score, internally only, as the deck does (brief: "never shown to users"); 6) id. Known queries must rank as the spec lists (e.g. `one piece` → the One Piece TV series first).
- **Cap: 200 results**, 24 per page with **Show more** (as 0016, no infinite scroll).

### Results

- 0006 grid and `TitleCard`: title, meta line (`TV · 2023 · 28 eps`), and the 0006 search context line `Also known as …` when the match wasn't on the shown title.
- Above the grid: `36 results for "frieren"` (`200+ results` at the cap), announced to screen readers through a polite live region once per settled search.
- Adult titles keep the 18+ badge and blurred poster from 0010. Unaired titles get no rating or Watched controls (0010).
- Posters use the current poster component and sources (0008, and 0017 once spec 08 ships). Search adds no image logic of its own.
- **Signed in:** the card shows your state and the quick actions, and a card click opens the edit sheet from 0016. Search reuses it.
- **Signed out:** cards show no quick actions. A card click goes to log in, then back to the same search.

### States

| State       | What shows                                                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty field | One line: "Find any anime by its English, romaji or Japanese title." Nothing else for now.                                                                                                         |
| 1 character | The same line. No request is sent.                                                                                                                                                                 |
| Loading     | First search: skeleton cards. Later searches: the old results stay, dimmed, until the new ones arrive (no layout jump).                                                                            |
| No results  | Large text: `No anime match "naurto".` Below it: "Check the spelling, or try another of its titles: the Japanese one or the English one." And a **Clear search** button. The query stays editable. |
| Error       | "Search isn't working right now." and a **Try again** button.                                                                                                                                      |

### Data and backend

- One new migration with one function, e.g. `public.search_anime(p_query text, p_offset int, p_limit int)`. It returns ids, title, meta, matched alias, the caller's own tracking state (none when signed out), and a total capped at 201. It never returns a score or similarity value.
- It follows `deck_next`'s pattern: `security definer`, `set search_path = ''`, user state limited to `auth.uid()`, and execute granted to `anon` and `authenticated`. It rejects queries shorter than 2 or longer than 100 characters.
- Target: under 150 ms in the database for the probe queries (`EXPLAIN ANALYZE` in the PR shows the trigram Bitmap Index Scan).

### Gamification

None. Search is a tool. No counts, streaks or rewards.

## Consequences

- No new tables or indexes, so it's quick to build. The `tsvector` that spec 01 mentioned isn't needed. This decision replaces that assumption.
- **Known gap:** swapped-letter typos ("naurto") find nothing. The no-results copy points to other titles. If real searches show it matters, the follow-up is option 3.
- Search depends on the 0016 edit sheet, so spec 09 builds after spec 07 (Library) is merged.
- Discover becomes a nav item now (four of 0002's five). Brief, Decisions list: one line once approved ("Title search on Discover; filters later").
- Filters (#11's genre/tags, studio, year, format) need their own decision. They'll sit under the field on the same page.
- Reviews check: every probe query ranks as the spec says; Japanese and English queries work; no score or similarity in any response; 1-character queries send no request; URL `replace` behaviour; signed-out flow; no-results and error states; keyboard-only use and the live region; 390 px and 1440 px screenshots.
