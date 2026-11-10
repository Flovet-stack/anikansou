# 0030: Growth order and a January 2027 launch

- **Status:** Approved
- **Proposed:** 2026-11-08 by the product team (roles: Product, PM, Gamification, Copy)
- **Approved:** 2026-11-08 by Flovet
- **Specs:** (filled in when a spec implements it)

## Context

Flovet wants traffic and users using free platforms only. Production has one real account; the other 441 are e2e test accounts. Search takes weeks to crawl and longer to bring visitors, so it can't supply the first users alone. Fans with long histories on MyAnimeList or AniList also face a high cost to switch.

## Research

| Reference                    | What they do                                                                                    | Adopt / adapt / reject | Why                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| Letterboxd                   | Reviews spread as screenshots and quote cards; "Four Favorites" videos invite people to join in | Adapt                  | Top 4 and share cards are already in the brief                                                   |
| Anime Tracker (Product Hunt) | 22 upvotes; Discord with a founding badge for the first 100 members                             | Adapt                  | A launch day alone brings a modest audience; community lasts longer                              |
| Show HN                      | Wants things people can try, ideally without sign-up; no asking friends to vote                 | Adopt                  | Public title pages make this possible                                                            |
| Product Hunt                 | Free, personal accounts only; ask for comments, never upvotes                                   | Adopt                  | A useful one-time event, not a main channel                                                      |
| AlternativeTo                | MyAnimeList page lists 93 alternatives                                                          | Adopt                  | Keeps reaching people looking to switch                                                          |
| Reddit                       | Rules vary by subreddit                                                                         | Adapt                  | **Not verified.** Reddit was blocked in our tools, so read each subreddit's rules before posting |

Sources (links actually opened):

- https://nogood.io/blog/letterboxd-marketing/
- https://izzyscott.substack.com/p/what-makes-a-perfect-letterboxd-top
- https://www.producthunt.com/products/anime-tracker
- https://www.producthunt.com/launch
- https://news.ycombinator.com/showhn.html
- https://alternativeto.net/software/my-anime-list/

## Options

1. **Launch to communities now.** Fastest attention, but no public pages, no import and nothing to share, and a first impression can't be repeated.
2. **Build the minimum, then launch for Winter 2027.** About eight weeks' delay, with a natural moment to post.
3. **Search only, no launch.** Lowest effort, but likely months with almost no users.

## Decision

Option 2, in phases, each gated on the one before:

1. **Foundations:** tools from 0029, test data removed.
2. **Indexable pages:** 0028.
3. **Worth sharing:** MAL and AniList file import, public profile with top 4, a share card, 20 real people through import and the deck. Each needs its own spec.
4. **Launch, January 2027:** Reddit where rules allow, Show HN, Product Hunt, AlternativeTo, one video platform weekly, and one hand-written watch order a week.

This moves watch-order guides (brief item 36) up from "Can wait", as hand-written pages only. The share format follows the achievements direction: ratings and taste, with no streaks or leaderboards. A founding-member badge isn't included and would need its own decision.

## Consequences

- Other brief features wait about eight weeks.
- Starting targets are guesses, because no reliable data for comparable sites was found. Reset them after the first month.
- Never use extra accounts, ask for votes or buy links.
- A review should check that the launch doesn't start before the 20-user gate is met.
