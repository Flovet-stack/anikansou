# 0025: Our own community rating, and what to show until we have one

- **Status:** Approved
- **Proposed:** 2026-11-08 by the product team (roles: Product, Database, Backend, Tech Lead, UX, Copy)
- **Approved:** 2026-11-11 by Flovet ("I approve all decisions"); this also approves the schema changes it describes
- **Supersedes:** the brief's "that score is never shown to users", only as far as this entry says (the deck keeps its private order)
- **Specs:**

## Context

Flovet, 2026-11-08: "we are going to save these ratings for every title, and we are going to build our own rating" like IMDb's, and show it publicly. "For now, we can be showing rating from a popular platform."

Team's reading of this, to be corrected if wrong: "disclose" means showing each title's rating publicly, not publishing every user's individual ratings.

What exists:

- `user_anime.rating` (1–10) is already saved per user and title (0011), and needs Watched (0015). Only about 905 tracking rows existed on 2026-11-08 (0021), so almost no title has enough ratings yet.
- `catalog.anime_scores` holds the dataset's aggregated score from other sites for about 70% of titles. It's private and orders the deck. The dataset gives no vote count, and scores resting on few sites are unreliable: migration `20261106160000_deck_order.sql` already damps them for that reason.

## Research

| Reference             | What they do                                                                                                                                                                                                                                    | Adopt / adapt / reject                                                             | Why                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| IMDb ratings          | Publishes a weighted average, not the mean; needs at least 5 ratings; keeps its weights secret to prevent manipulation; adjusts weighting when it detects unusual activity; the breakdown page shows the raw mean. Top 250 needs 25,000 ratings | Adapt: weighted number, plus a breakdown, plus a minimum. Keep abuse rules private | The model Flovet named                                                              |
| Letterboxd            | Shows a weighted average out of five with a histogram. One study finds shrinkage towards the mean. Its weighting drew suspicion because it's unexplained                                                                                        | Adapt: histogram, shrinkage, and explain the basic method                          | Secrecy costs trust. Explain the method; keep only the abuse signals private        |
| Our deck order (0014) | Already damps scores with `(score × n + average × K) / (n + K)`                                                                                                                                                                                 | Adopt the same shape                                                               | Known, simple, and already in the codebase                                          |
| AniList score         | API is free non-commercially, but its terms prohibit competing list or tracker services and using the API for data storage                                                                                                                      | **Reject**                                                                         | AniKansou is a tracker. Asking would also add to the open permission request (0017) |
| MyAnimeList score     | Commercial use needs written authorisation; direct competitor (0008)                                                                                                                                                                            | Reject                                                                             | Already rejected                                                                    |
| Kitsu score           | Terms bar displaying its content on another site without consent (0023 multi-source)                                                                                                                                                            | Reject                                                                             | Same reason                                                                         |
| TMDB vote average     | Allowed live with credit while non-commercial; one show holds many seasons; about 16,177 of our titles could match; no key yet (0022)                                                                                                           | Reject for now                                                                     | Wrong season, votes from a general audience, and ends if we earn money              |

Sources (opened):

- https://help.imdb.com/article/imdb/track-movies-tv/ratings-faq/G67Y87TFYYP6TWAV
- https://anilist.gitbook.io/anilist-apiv2-docs/docs/guide/terms-of-use

Seen only as search summaries: https://sol.sbc.org.br/index.php/webmedia/article/download/37951/37729 (Letterboxd shrinkage study) · https://www.dailydot.com/?p=1348013 (Letterboxd weighting controversy)

Our context: `PROJECT_BRIEF.md`, 0008, 0011, 0014, 0015, 0021, 0022, 0023 (multi-source catalog).

## Options for the stand-in rating

1. **The dataset's aggregated score, labelled as coming from other sites (team's recommendation).** Already in our database, licensed to show under ODbL with credit, no API, no key, covers about 70%. It isn't one famous platform's number, which is the trade-off against what Flovet described.
2. **TMDB's vote average.** A recognisable name, but it's per show rather than per season and its licence stops if we earn money.
3. **Nothing until ours is ready.** Honest and simple, but titles look empty for a long time.

No popular anime platform's own number can be shown under its terms today. If AniList grants written permission that covers this, it can be reconsidered.

## Decision

### Our rating

- **Name:** "AniKansou rating", shown in stars out of 5 with one decimal, plus the number of ratings. Copy check at spec time.
- **Formula:** `(R × v + C × m) / (v + m)`, where `R` is the title's mean, `v` its number of ratings, `C` the site-wide mean and `m` a damping constant, starting at 25. A title with few ratings stays close to the site average until it earns its own.
- **Shown from 10 ratings.** Below that, there's no AniKansou rating, as the number would mostly reflect the damping. Charts (#25) set their own higher bar.
- **Breakdown:** a histogram of half-star counts, always aggregated. Individual ratings are never exposed by this.
- **Openness:** we publish the formula on a help page, and keep abuse signals private, as IMDb does.
- **Abuse:** ratings from accounts an admin has flagged are left out of the public number. Their own ratings and badges stay as they are. Automatic detection comes later, when there's something to detect.

### The stand-in

- Shown only when a title has no AniKansou rating yet, and only when at least 3 sites contributed to it, to avoid the thin scores the deck already damps. A perfect 10.00 is never shown: 34 titles have one, mostly from tiny samples (0014). The threshold is checked at spec time against live data.
- Worded so it can't be mistaken for ours, for example "8.6/10 on other sites", on its own scale and not as stars. Scale confirmed against the dataset at spec time.
- Credit follows the ODbL notice we already carry.
- Once a title reaches 10 ratings, ours replaces it. The two are never blended.
- Removed entirely by a later decision, once most viewed titles have ours.

### Data

- Ratings stay in `public.user_anime`. Per-title totals go in a new table outside `catalog`, for example `public.anime_rating_stats` (`anime_id`, `count`, `sum`, half-star histogram, `updated_at`), kept current by a trigger, with no background job.
- Readable by everyone. Writable only by the trigger. Migration is **Ask first**.
- Merged titles (retire and redirect) move their totals with the ratings.

### Brief change on approval

Under Must have:

`42. AniKansou rating: a public per-title rating from our users' star ratings, with the dataset's score from other sites as a labelled stand-in until a title has enough ratings (0025)`

Plus a line in the Decisions list, and the "never shown to users" entry amended by a new line. The deck's order stays private.

## Consequences

- Reverses "aggregate score: never" (brief and 0021), as far as described here. The raw score, `anime_scores` table and deck order stay private; only a labelled value is returned.
- Showing the dataset's score makes the brief's existing legal check on crawled data a little more relevant, because these numbers come from other sites through the dataset. Not legal advice; include it in that check.
- Our rating depends on real use, so it appears first on popular titles. Rewarding ratings (0024) may add rushed ones.
- If ratings skew because the deck shows high-scoring titles first, the site mean `C` will skew too. Watch this once there's data.
- Reviews check: no individual rating readable by others; 9 ratings shows no AniKansou rating, 10 does; formula tested with known values; stand-in never shown as stars or alongside ours; flagged accounts excluded; deck order unreadable; RLS tested.
