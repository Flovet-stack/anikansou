# 0014: Deck order: aired first, small samples damped

- **Status:** Approved
- **Proposed:** 2026-11-06 by the product team (roles: Product, Database, Tech Lead)
- **Approved:** 2026-11-06 by Flovet ("Aired first, damp tiny samples")
- **Supersedes:** the "Order" section of [0010](0010-deck-content-and-order.md). Everything else in 0010 stands.
- **Specs:** specs/05-swipe-deck.md

## Context

0010 orders the deck by the dataset's aggregated score, highest first, so that "early swipes are mostly 'seen it'". Building spec 05 showed that this does the opposite. The score is an average with no vote count, and **34 anime have a perfect 10.00**, mostly from tiny samples. A new user's first 12 cards were obscure titles (_Battle Spirits: Core no Hikarinushi-tachi_), and 7 of them hadn't aired, so they couldn't be rated or marked seen. Well-known titles sat far lower: _Sousou no Frieren_ 9.10, _Death Note_ 8.71, _Cowboy Bebop_ 8.56.

## Research

| Data checked (live catalog, 2026-11-06)             | Finding                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Score distribution                                  | 34 titles at exactly 10.00, then a handful between 9.5 and 9.9; the catalog average is 6.28                                                                                                                                                                                                                     |
| Sites listing each anime (`catalog.external_ids`)   | Well-known titles are on 10 or more sites; the obscure perfect-10 leader was on 2. Weak but usable as a confidence signal                                                                                                                                                                                       |
| Top 40 aired titles with the damping below (K = 10) | Frieren, Fullmetal Alchemist: Brotherhood, Steins;Gate, The Apothecary Diaries, Attack on Titan, Hunter x Hunter, A Silent Voice, Your Name., Death Note, Spirited Away, Jujutsu Kaisen, One Piece, Vinland Saga… Two perfect-10s listed on 6–8 sites still led until perfect scores were treated as unreliable |

The approach mirrors the common "Bayesian average" used by rating sites to stop tiny samples from topping charts (team knowledge, not re-checked this session).

## Options

1. **Aired first; damp scores toward the average by how many sites list the anime; a perfect 10 counts as no evidence (recommended, chosen).**
2. Aired first, pure score order within them: obscure perfect-10s still open the deck.
3. Keep 0010's order.

## Decision

- **Aired before unaired.** Unaired titles still appear (0010), after every aired one.
- **Damped score:** `(score × sites + catalog average × 10) / (sites + 10)`, where `sites` is the number of sites listing the anime, and **a score of exactly 10 counts as 0 sites**. Unscored anime come after every scored one (as before).
- Ties by anime id. The score and the damped score stay private; the cursor is still the last anime id (0010).
- **Precomputed:** working this out per request takes about 2 seconds, so the order lives in a private materialized view (`public.deck_order`, no API access). `deck_next` refreshes it after each successful catalog import, on its first call, so the importer doesn't change.

## Consequences

- New users start on titles they're likely to know, and every early card can be rated.
- The first `deck_next` call after an import takes about 2 seconds while the view refreshes; every other call stays under 50 ms.
- The damping constant (10) and the perfect-10 rule are tuned for this dataset; revisit if a popularity or vote-count source is added.
- Reviews check: the order matches this rule (database tests), no score or rank leaves the database, and the view has no API grants.
