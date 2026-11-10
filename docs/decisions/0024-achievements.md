# 0024: Milestone badges for ratings, Watched and contributions, announced everywhere

- **Status:** Approved
- **Proposed:** 2026-11-08 by the product team (roles: Product, Gamification, Database, Backend, UX, UI, Copy, Tech Lead); revised 2026-11-08 and twice on 2026-11-10 after Flovet's feedback
- **Approved:** 2026-11-11 by Flovet ("I approve all decisions"); this also approves the schema changes it describes
- **Supersedes:** the deck's milestones in [0009](0009-swipe-deck-interaction.md) (10, 25, 50 and 100 ratings, shown on the Rate page only). The rest of 0009 stands.
- **Specs:**

## Context

Flovet asked to add an achievement system to the Must have features, in the spirit of IMDb, Letterboxd, Stack Overflow and Duolingo. Direction since:

- "This is not a social media app." Star ratings, Watched and contributions matter, because they build our own data. "Liking an anime should not get points."
- No guilt mechanics: no streaks, no leaderboards.
- 2026-11-10: research whether an achievement system is worth keeping. If not, keep it to ratings, with a notification when a milestone is reached, "globally each time they reach a milestone, not only on the rate page".

**What exists today (0009):** the Rate page shows a progress ring and a one-line message at 10, 25, 50 and 100 ratings. Nothing about it is stored: the page reads your rating count from the database, and the browser compares it with the milestones. So it only fires on the Rate page, it never fires for ratings given in the library or search, and clearing and re-adding a rating across a milestone shows it again.

Related: [0025](0025-community-rating.md) (our own rating), [0026](0026-community-contributions.md) (contributions, with the admin dashboard later).

## Research

| Reference                                                                 | What they do                                                                                                                       | Adopt / adapt / reject                                                       | Why                                                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| IMDb badges                                                               | Bronze, silver and gold contribution badges per category; rating-based badges (Oscars, Top 250); leaderboards count approved items | Adapt: tiered badges for rating and approved contributions. Reject top lists | Rating and contributing are what's recognised, as Flovet wants                                                                |
| Stack Overflow reputation                                                 | Points come from other people's votes and unlock privileges, such as edits applying immediately at 2,000                           | **Reject a points total**                                                    | The total works there because it means trust and unlocks things. Ours would come from a user's own actions and unlock nothing |
| Stack Overflow badges                                                     | Bronze "easy to get if you try", silver needs planning, gold "rarely awarded". Edit ladder: first edit, 80, 500                    | Adapt: tier meanings and ladders. Reject consecutive-day badges              | Consecutive-day badges penalise a break                                                                                       |
| Duolingo achievements                                                     | Moved badges out of a buried profile page to one shelf, and celebrates them at the moment they're earned                           | Adopt: a celebration wherever it happens, and one place to see them          | Their stated problem: badges were "hard to find, and harder to celebrate"                                                     |
| Duolingo leagues and streaks                                              | Competitive leagues, streaks                                                                                                       | Reject                                                                       | Flovet's rule and the brief                                                                                                   |
| Letterboxd                                                                | Its FAQ describes no achievements, badges, points or levels; recognition is stats and year in review                               | Adopt the restraint                                                          | A thriving site in our category without badges: keep ours small and quiet                                                     |
| Anderson et al., "Steering user behavior with badges" (2013)              | Users speed up near a threshold, then return to normal. Badges raised participation                                                | Adapt: ladders, and guard the data                                           | Rewarded actions get pressed more, and ratings are our data (0025)                                                            |
| Kusmierczyk & Gomez-Rodriguez (2017)                                      | First-time badges change behaviour only when the action's own utility is low                                                       | Adopt: no reward for likes; contributions matter most                        | Liking needs no incentive; correcting data does                                                                               |
| Overjustification research (Deci, Koestner & Ryan 1999; Tang & Hall 1995) | Task-contingent rewards can undermine activities people enjoy; rewards signalling competence are less likely to                    | Adopt: milestones worded as a record of what you did                         | A points total per action is the most task-contingent option                                                                  |
| deceptive.design                                                          | Names nagging, addictive design, fake urgency and fake scarcity                                                                    | Adopt as the review list                                                     | Matches the no-guilt rule                                                                                                     |

Sources (opened): https://www.imdb.com/badge/index · https://stackoverflow.com/help/whats-reputation · https://stackoverflow.com/help/privileges · https://stackoverflow.com/help/badges · https://stackoverflow.blog/2021/04/12/stack-overflow-badges-explained · https://blog.duolingo.com/achievement-badges · https://letterboxd.com/about/faq/ · https://arxiv.org/abs/1707.08160 (abstract only) · https://en.wikipedia.org/wiki/Overjustification_effect (secondary) · https://www.deceptive.design/types

Seen only as search summaries: Anderson et al. https://archives.iw3c2.org/www2013/proceedings/p95.pdf (the PDF wouldn't parse) · https://courses.grainger.illinois.edu/cs598hs/sp2020/lectures/badges.pdf

## Is it worth keeping?

**Partly.** What the evidence supports, and what it doesn't:

| Part                      | Verdict                        | Reason                                                                                                                                           |
| ------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Milestone moments         | **Keep, and make them global** | Cheap, positive, already liked on the deck (0009). Duolingo's lesson: celebrate at the moment, wherever it happens                               |
| A record of earned badges | **Keep, small**                | Without one, a milestone is a toast that's gone. Storing it is also what makes "once, everywhere" possible                                       |
| Contributions track       | **Keep, later**                | The strongest case in the research (low-utility action, real value to the site). Waits for the admin dashboard (0026)                            |
| Kansou points total       | **Drop for now**               | No leaderboards and no privileges, so a total has no use. Letterboxd does fine without one. Stored badges let us add it later, with no data lost |
| Likes                     | **Drop**                       | Flovet's call, and the research agrees                                                                                                           |

## Options

1. **Stored milestone badges, announced on any page, no points (chosen).** What the verdict above supports.
2. **The full first draft:** badges, Kansou points and a profile shelf. More to build, and a number with no purpose.
3. **Keep today's deck-only messages.** No database work, but they miss ratings given elsewhere and repeat.

## Decision

Option 1.

### 1. Tracks and milestones

| Track         | Counts                           | Milestones                          | Ships                           |
| ------------- | -------------------------------- | ----------------------------------- | ------------------------------- |
| Ratings       | Titles with a star rating        | 1, 10, 25, 50, 100, 250, 500, 1,000 | First                           |
| Watched       | Titles marked Watched            | 1, 10, 25, 50, 100, 250, 500, 1,000 | First                           |
| Contributions | Submissions approved by an admin | 1, 5, 25, 100, 250, 1,000           | With the admin dashboard (0026) |

Tiers: the first three milestones of each track are bronze, the middle ones silver, the last two gold. Likes earn nothing.

Rating needs Watched (0015), so Watched milestones usually come first. If both tracks hit a milestone from one action, they're announced together in one notification.

### 2. The notification

- **Global:** it appears on whatever page the action happened: the deck, the library, search, the details sheet.
- **Once:** each milestone is stored when earned, so it's never shown again, on any device. Clearing and re-adding a rating doesn't repeat it.
- **Light:** a toast with the badge, one line and no button to dismiss it unless the user wants to. It doesn't block input or interrupt swiping. The deck keeps its accent burst; reduced motion turns the animation off and keeps the message.
- **Copy:** one line, no guilt, carried over from 0009's tone: "25 ratings. Your taste is taking shape."
- **No inbox yet.** A list of past notifications is brief #29, later.

### 3. Where earned badges show

A small badges row on your own profile, with progress to the next one per track ("38 of 50 ratings"). Users can hide it from their public profile. Badge artwork gets its own UI decision with the spec.

### 4. Kind and honest

- Badges are never taken away by ordinary use. An admin can reverse contribution badges earned in bad faith.
- No streaks, decay, deadlines, leagues, leaderboards, limited-time badges or nudges.
- Badges never unlock permissions.
- The deck's progress ring stays, pointed at the next rating milestone.

### 5. Data

The spec finalises this; the migration is **Ask first**.

- `public.user_achievements`: `user_id`, `track`, `milestone`, `earned_at`. Primary key `(user_id, track, milestone)`, so a milestone is earned once, even under two requests at once.
- Awarded inside the same database function as the action (0011), which returns anything newly earned with its result. Every page that rates or sets a status already goes through those functions, so the notification needs no extra request. No background job.
- RLS: users read their own rows and can't write any.
- Existing ratings and Watched titles are backfilled once, silently.

### 6. Brief change on approval

Under Must have, keeping existing numbers:

`40. Milestone badges for ratings, Watched and approved contributions, announced on any page when earned (0024)`

Plus a line in the brief's Decisions list.

## Consequences

- Replaces the deck's milestone code (`MILESTONES`, `milestoneReached`, `milestoneMessage` in `src/features/deck`) with server-confirmed awards, and adds a notification host to the app shell.
- Points can be added later by a new decision, computed from stored badges.
- Riskiest assumption: people value the moments outside the deck. Cheapest test: ship ratings and Watched, and watch whether rating quality changes.
- Reviews check: a milestone shows once across pages and devices; library and search actions trigger it; clearing and re-rating doesn't repeat it; users can't insert awards (RLS test with a second user); no notification for likes; reduced motion respected; no guilt copy.
