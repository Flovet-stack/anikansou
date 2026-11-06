# 0010: What the deck shows, and in what order

- **Status:** Approved
- **Proposed:** 2026-11-06 by the product team (roles: Product, Database, UX, Tech Lead)
- **Approved:** 2026-11-06 by Flovet, including the 18+ badge and blurred adult posters
- **Revised:** 2026-11-06 after Flovet's review: the deck covers unaired and adult titles too; unaired titles get no rating or Watched controls.
- **Specs:** specs/05-swipe-deck.md

## Context

Brief: "The swipe deck is ordered by the dataset's aggregated score internally; that score is never shown to users." `catalog.anime_scores` is service-only (no grants to `anon` or `authenticated`), so the app can't read it directly. The catalog has about 38,000 anime of every type, including unaired ones and adult titles; the brief's NSFW filter (#23) isn't built yet. This entry decides which titles may appear, in what order, what each card shows, and how the scores stay hidden.

Flovet, reviewing the first version: "I want the deck to cover even unaired and adult titles but the unaired titles will not have a rating or watched button."

## Research

| Reference                                                                                               | What they do                                                       | Adopt / adapt / reject | Why                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Our brief                                                                                               | Order by aggregate score; never show it                            | Adopt                  | Already approved                                                                                      |
| Swipe apps (Scene it, Slate)                                                                            | Lead with widely known titles so most early swipes are "seen"      | Adopt                  | Popular, well-rated titles first means early swipes are mostly "seen it", which feeds ratings fastest |
| Supabase docs: `security definer` functions with a fixed `search_path` (team knowledge, not re-checked) | A function can read a private table and return only chosen columns | Adopt                  | Lets the deck order by score without exposing it                                                      |
| [0006](0006-title-card.md) title card                                                                   | Title beneath art, meta line, never the aggregate score            | Adapt                  | The deck card is a large single card, so it can show a little more (studio, tags)                     |

Sources: the brief and decisions 0006 and 0008; Scene it (https://apps.apple.com/app/id6760948516). The Supabase pattern is team knowledge, to be checked against the docs for the installed version in the spec.

## Options

1. **A server function returns the next cards for the signed-in user, ordered by score, with no score in the result (recommended).**
2. Precompute a public `deck_rank` column: simpler reads, but the rank leaks the score order to anyone.
3. Random order: breaks the brief's ordering rule and front-loads obscure titles.

## Decision

Proposed: option 1.

### Which titles may appear

- Not retired.
- Type `tv`, `movie`, `ona` or `ova`. Specials are still left out (mostly recaps and extras); say if you want them too.
- **Any airing status:** `finished`, `ongoing` and `upcoming`. Upcoming titles can't be rated or marked with a status (see [0009](0009-swipe-deck-interaction.md), "Unaired titles"); the database refuses those writes too.
- **Adult titles are included.** Until the NSFW filter (brief #23) ships with its own decision, the team adds two safeguards: an "18+" badge on the card, and **the poster is blurred until the user reveals it** (one click or tap, remembered for the session). Adult titles are identified by a list of adult-content tags, checked against the catalog during the spec and written into the migration.
- Not already acted on by this user: no status, no rating and not on the watchlist. Liked-only titles still appear (a like isn't a verdict).
- Not skipped ("Not seen" on touch) or passed (moved past on the web) by this user in the last 30 days.

### Order

- `catalog.anime_scores.arithmetic_geometric_mean`, highest first; ties by `anime.id`. Titles without a score come after all scored titles.
- Cursor-based paging (the last returned position), never offsets, so undo and new actions don't shift what comes next.

### Access

- A `security definer` function (for example `public.deck_next(after_position, page_size)`) with `set search_path = ''`, executable by `authenticated` only. It reads the score internally and returns only: anime id, title, native title (when known), type, year, season, episodes, duration, up to 3 studios, up to 3 tags and an opaque cursor. **It never returns the score, nor anything from which it can be derived exactly** (the cursor is an encoded position, not the score).

### The deck card

- Poster (posters from [spec 03](../../specs/03-poster-sources.md) when available, else the generated fallback from [0004](0004-placeholder-poster-art.md)), large: as wide as the column allows, up to 360 px, 2:3.
- Beneath: the title (`title-m`, 25 px, up to 3 lines), the meta line (`TV · 2023 · 28 eps`), then a quieter line with studio and season (`Madhouse · Fall 2023`), and up to 3 tags as small chips.
- Never: the aggregate score, rank numbers or "popular" badges that reveal it.

## Consequences

- Ordering stays private and server-side; the brief's rule holds even against someone reading network traffic.
- The deck query needs an index path for "next by score after cursor, excluding this user's titles"; the spec checks it with `EXPLAIN ANALYZE`.
- When the NSFW filter ships, its decision replaces the blur-and-badge safeguard with a user setting (likely off by default for new users). Until then, adult titles appear for every signed-in user, and the site has no age check: a product and legal risk to weigh before launch (the brief already lists a legal check).
- Reviews check: no score or score-derived value in any response; adult titles carry the badge and a blurred poster; upcoming titles can't be rated or given a status (UI and database); specials never appear; skipped and passed titles return after 30 days.
