# 0027: Never store data from APIs that don't allow copying

- **Status:** Rejected
- **Proposed:** 2026-11-10 by the product team (roles: Tech Lead, Backend, Database, Frontend)
- **Rejected:** 2026-11-10 by Flovet ("We need to keep the links"). 0017 stands unchanged.
- **Supersedes:** on approval, item 3 of [0017](0017-anilist-posters-on-view.md) ("Stored as links only"), and its "Look up on view, remember the result" option. The rest of 0017 stands.
- **Specs:**

## Context

Flovet's rule on data (0026): sources that allow copying are copied and edited; sources that don't are shown on the fly, never edited. Asked whether that covers storage too, Flovet answered on 2026-11-10: "Storage too".

0017 does the opposite for AniList. It stores each cover link in `catalog.anime_images` (source `anilist`), plus a 30-day "no cover" marker, through `catalog.record_anilist_covers` (migration `20261107150000_anilist_covers.sql`). About 136 titles had stored covers on 2026-11-08 (0021). AniList's terms also prohibit using the API "as a backup or data storage service" (opened 2026-11-08).

## Research

Our own context only. 0017 already researched and weighed this exact option (its option 2, "Look up on every view, keep nothing"), so no new outside research was needed:

- AniList allows 90 requests a minute normally, and 30 while degraded. One request covers up to 50 titles.
- Deck pages differ per user, so a shared app cache rarely hits.
- The generated poster is the fallback, so going over the limit degrades the look, not the app.

## Options

1. **Nothing in the database; a short-lived server memory cache (team's recommendation).** Each server keeps cover links it fetched in memory for up to 1 hour, and loses them on restart. Repeat views within the hour cost no request. Nothing reaches the database, the Next.js data cache or disk.
2. **No cache at all.** Every page asks AniList. The strictest reading, and the first to fall back to generated posters with a few users at once.
3. **Keep 0017 as it is.** Against Flovet's answer.

Option 1 is a judgement call on what "storage" means: memory that disappears within an hour, on our server only, is treated as not storing. If Flovet disagrees, option 2 applies.

## Decision

Option 1.

1. **Remove what's stored.** A migration deletes AniList rows from `catalog.anime_images` and the no-cover markers, drops `catalog.record_anilist_covers`, and keeps the `anilist` source row for its credit and locked host.
2. **Look up on every view,** still only for titles on screen, server-side and batched (0017 items 1, 2, 4, 5 and 6 unchanged).
3. **Memory cache only,** at most 1 hour per link, per server. "No cover" answers are cached the same way, so a missing cover isn't asked for again within the hour.
4. **The general rule,** for every source from now on: a source's licence decides whether its data may sit in our database. If not, it's fetched for display and gone within the hour, and it never gets an edit control (0026).

## Consequences

- Schema change: deletes rows and a function. **Ask first** (approving this counts).
- More AniList requests than today, so generated posters show more often at busy times. This was 0017's reason for storing; Flovet's rule now outweighs it.
- 0022's proposed TMDB cache (up to 6 months) must become on-view only too. That decision lives in another worktree and needs revising there.
- Brief changes on approval: the Images line drops "link stored", and the Decisions list gains a line for this rule.
- Reviews check: no AniList data in any table after the migration; no AniList value in the Next.js data cache or on disk; the memory cache expires within an hour; pages still render when AniList is down.
