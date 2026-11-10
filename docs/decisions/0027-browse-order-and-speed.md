# 0027: Browsing uses the deck's order

- **Status:** Approved
- **Proposed:** 2026-11-08 by the product team (roles: Tech Lead, Database, Product)
- **Approved:** 2026-11-08 by Flovet ("Yes, apply it")
- **Amends:** [0020](0020-search-filters.md), its "Best match" rule, for browsing without a query only
- **Specs:** specs/10-search-filters.md

## Context

0020 says Best match without a query "uses the dataset's aggregated score, internally only, as the deck does". The spec 10 build used the raw score, and that went wrong in two ways on the live catalog:

- **Junk led every browse.** 34 anime have a perfect 10.00, mostly from tiny samples ([0014](0014-deck-order.md) records this). The top raw results were `Battle Spirits: Core no Hikarinushi-tachi`, `Bloody Bunny: The First Blood` and `LuLuLu`. Unaired titles also came first.
- **It missed 0020's speed target.** The Finished filter alone (36,664 anime) took 205–250 ms in the database, against the 150 ms target, because every match was ranked.

## Research

| Reference                                  | What it does                                                                                     | Adopt / adapt / reject | Why                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Our deck order, 0014 (`public.deck_order`) | Aired first, then a score damped by how many sites list the anime                                | Adopt                  | Already built and refreshed after each import; its top results are Sousou no Frieren, Fullmetal Alchemist: Brotherhood and Steins;Gate |
| Our live catalog, dry run rolled back      | First 201 only: Finished best 83–139 ms warm (one 177 ms), Finished by title 67 ms, Action 60 ms | Adopt                  | The page can't show or count past 201 anyway                                                                                           |

## Options

1. **Deck order when browsing, and rank only the first 201 (chosen).**
2. **Aired first with the raw score.** Faster to explain, but perfect 10s from tiny samples keep leading.
3. **Keep the raw score** as 0020 is worded. Junk first, and unaired titles first.

## Decision

Option 1.

- **Best match without a query:** aired first, then the deck's damped rank. Specials aren't in the deck, so they follow, by the raw score.
- **Best match with a query:** unchanged (0018, 0019).
- **Every search** ranks only its first 201 matches, which is all the page can show or count. `200+ results` and the 200 cap behave as before.
- **More than 24 genres** are rejected, since each one costs a lookup.
- One new migration. It adds no tables or indexes.

## Consequences

- Specials sit below every other format when browsing by Best match. Picking Special as the only type shows them in raw-score order, which can still surface a perfect 10 from a tiny sample.
- The deck's rank is read as it stands; only the deck refreshes it after an import, as today.
- Reviews check: the first results for a broad filter are well-known titles, no score leaves the database, and the widest filters stay under 150 ms when warm.
