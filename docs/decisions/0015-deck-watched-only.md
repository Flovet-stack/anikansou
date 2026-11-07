# 0015: Deck offers Watched only, and rating needs Watched

- **Status:** Approved
- **Proposed:** 2026-11-07 by the product team (roles: Product, UX, Gamification, Frontend, Database), from Flovet's direction
- **Approved:** 2026-11-07 by Flovet ("Approve all three")
- **Supersedes:** part of [0009](0009-swipe-deck-interaction.md): the web actions panel's Status row and the touch rating step's status row. The rest of 0009 stands.
- **Specs:** specs/06-deck-and-icon-fixes.md

## Context

Flovet, 2026-11-07: "the rate page cards do not need the watching, on hold or dropped buttons, just watched is enough, it reduces decision fatigue and I think the 5 star rating should be available only for watched titles."

0009 put all four statuses on every deck card, both on the web panel and in the touch rating step. In the deck, the user is deciding about one title in a few seconds, so four statuses next to stars, like and watchlist is the most choice on the screen. Watching, On hold and Dropped are tracking states that matter later (library, episode progress), not in a quick rating pass.

## Research

| Reference                                           | What they do                                                                          | Adopt / adapt / reject | Why                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| Letterboxd log/rate (team knowledge, not re-opened) | Quick actions are Watched, Like, Watchlist and stars; a rating marks the film watched | Adopt                  | Same three-plus-stars set Flovet asked for                                   |
| Hick's law (NN/g summary, team knowledge)           | Decision time grows with the number of choices                                        | Adopt                  | Removing three statuses from every card shortens each decision               |
| Duolingo (brief reference)                          | One clear action per screen in quick loops                                            | Adopt                  | The deck is the quick loop                                                   |
| Our 0011 data model                                 | Four statuses stay in the database                                                    | Keep                   | The library (and later the title page) still sets Watching, On hold, Dropped |

Sources: no new pages opened; this decision narrows an approved one at Flovet's direction.

## Options

1. **Watched only in the deck, stars only once Watched is on (chosen):** fewest choices; matches Flovet's direction.
2. **Watched only, but tapping a star also marks Watched (today's behaviour):** one click fewer on the web, but the stars are then available on titles that aren't watched, which Flovet ruled out.
3. **Keep four statuses behind a "More" menu:** keeps the power, adds a hidden menu to a quick loop. Rejected: the library covers it.

## Decision

Option 1.

### Web model

- The actions panel shows **Watched** (toggle, 0005 green, check icon), **Like** and **Watchlist**. No Watching, On hold or Dropped.
- **Stars are shown but disabled until Watched is on**, with the line "Mark it watched to rate it". Turning Watched on enables them; nothing is rated automatically.
- Keys: W toggles Watched. 1–9 and 0 rate only when Watched is on; otherwise they announce "Mark it watched first (W)" in the live region and save nothing. Backspace clears the rating. L and A unchanged.
- **Turning Watched off also removes the rating**, as one action with one Undo. A rating never exists without Watched.

### Touch model

- "Seen it" (swipe right) means Watched, as before. The rating step keeps the stars, the like heart, "Save without rating" and "Back", and **drops the status row**: the status is always Watched.
- "Not seen" and "Want to watch" unchanged.

### Titles already given another status

A card can still carry Watching, On hold or Dropped (from the library). The deck shows that status as a read-only chip ("On hold") with the Watched toggle beside it; turning Watched on replaces it. Stars stay disabled until Watched is on.

### Upcoming titles

Unchanged (0009, 0010): no Watched toggle and no stars.

## Consequences

- **Schema change (needs approval with this decision):** a new migration so that clearing the status also clears the rating in the same event (`set_status(anime_id, null)`), and so that `set_rating` refuses a rating unless the status is Watched (or `deck_seen` sets both). This replaces 0009's "a rating with no status sets Watched". Existing rows with a rating and another status are kept as they are; the rule applies to new writes.
- The library ([0016](0016-library.md)) is where Watching, On hold and Dropped are set.
- Reviews check: no Watching/On hold/Dropped control in the deck; stars disabled without Watched in both models; un-watching clears the rating with one undo; number keys do nothing without Watched; the e2e flows are updated.
