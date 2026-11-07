# 0019: Short search queries match the start of a title

- **Status:** Approved
- **Proposed:** 2026-11-07 by the product team (roles: Tech Lead, Database, UX, Product)
- **Approved:** 2026-11-07 by Flovet ("Prefix-match short ones")
- **Amends:** [0018](0018-title-search.md), its "Matching and ranking" section, for queries under 4 characters only
- **Specs:** specs/09-title-search.md

## Context

The spec 09 review measured the live search function with very short, common queries. 0018 sets a 150 ms target in the database.

| Query                                                 | Matches                         | Database time |
| ----------------------------------------------------- | ------------------------------- | ------------- |
| `no`                                                  | 201+ (about 100,000 title rows) | 550 ms        |
| `the`                                                 | 201+                            | 509 ms        |
| `ga`                                                  | 201+                            | 162 ms        |
| `one`                                                 | 201+                            | 51 ms         |
| spec 09's queries (`frieren`, `aot`, `進撃の巨人`, …) | 5–201+                          | 3–56 ms       |

Word similarity gives `no` a perfect score against every title with the particle "no" in it, so the function ranks a large share of the catalog before cutting a page. Those results are useless anyway: "Sousou no Frieren" isn't what someone typing `no` wants. Lowering the threshold only returns junk, as the 0018 probe showed.

## Research

| Reference                                                               | What they do                                                               | Adopt / adapt / reject | Why                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------- |
| Our live catalog (read-only probe above)                                | Short particles and articles match most romaji titles                      | Adopt                  | The cost and the useless results have the same cause |
| Baymard, autocomplete design (opened for 0018)                          | Early keystrokes complete the start of a term                              | Adapt                  | A short query is usually the start of a title        |
| PostgreSQL `text_pattern_ops` (team knowledge; verified by the dry run) | A btree index with `text_pattern_ops` serves `LIKE 'abc%'` prefix searches | Adopt                  | It is exact, small and fast on 262k rows             |
| Matching a word anywhere that starts with the query                     | `no` still matches every "… no …" title                                    | Reject                 | It fixes nothing for romaji                          |

Sources: the 0018 sources. `text_pattern_ops` is from team knowledge (the PostgreSQL operator-class page wasn't opened). It was verified instead by a dry run of the migration on the live catalog, rolled back: `no` 10 ms, `the` 66 ms, `ga` 13 ms, and every spec 09 ranking query unchanged.

## Options

1. **Short queries match the start of a title or alternate title (chosen).** A query with fewer than 4 letters or digits (after the 0018 normalization, not counting spaces or punctuation) matches titles whose `search_text` starts with it. Longer queries keep 0018's word similarity.
2. **Keep 0018 as is** and accept about 0.5 s for rare short searches. It misses the approved target, and the results stay useless.
3. **Cap the number of matched rows before ranking.** It's fast, but it ranks an arbitrary sample, so the best match can be missing.

## Decision

Option 1.

- **Short query:** fewer than 4 letters or digits. Examples: `no`, `the`, `aot`, `k-on` (3: k, o, n), `葬送` (2). It matches any title or synonym whose normalized text **starts with** the query: `no` → "No Game No Life", "Noragami"; `aot` → the "AoT" synonym of Shingeki no Kyojin; `葬送` → 葬送のフリーレン.
- **4 or more:** unchanged from 0018 (word similarity at 0.6).
- Ranking, the cap of 200, the result fields and every other part of 0018 are unchanged.
- **One new index:** a btree on `catalog.anime_titles.search_text` with `text_pattern_ops`, so prefix matches stay fast. It's added in the same new migration as the function change.
- **Same migration, a spec fix:** signed out, the function returns null for status, rating, liked and watchlisted, as spec 09 criterion 2 says (it returned `false` for liked and watchlisted).
- **Target:** every query, including `no`, `the` and `ga`, under 150 ms in the database.

## Consequences

- A 2–3 letter query that only appears in the middle of a title (`bop` for "Cowboy Bebop") no longer finds it. Typing one more letter switches to word similarity (`bebo` finds it).
- The no-results copy still applies. Reviews check that `no`, `the` and `ga` stay under 150 ms, and that spec 09's ranking queries still rank as listed.
- The importer is untouched: the index covers the existing column.
