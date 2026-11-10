# Project brief: AniKansou

Last updated: 2026-11-11

This brief describes the whole product. It does not change when a phase or sprint is planned: phase plans and task specs live in `specs/`.

## Product

- What it is: a Letterboxd-style site for anime. "Kansou" (感想) means thoughts after watching.
- Users and their main job: anime fans who want to record what they've watched and what they thought of it.
- Core loop: sign up, swipe through anime cards, rate, set status, add to watchlist, like; then review, list, share and track progress over time.
- Differentiators: a fast, gamified swipe-to-rate experience and franchise grouping.

## How scope is delivered (rules for AI agents)

- The features below are the full planned scope. They are built **gradually, one small piece at a time**.
- **Never implement more than the current task spec asks for.** Never attempt several features at once, and never build a feature "while you're there".
- The current task is always defined by a spec in `specs/`. If no spec covers it, ask before building.
- **Nothing runs without approval.** The product team (product-team skill) researches and makes every product, UX, UI and architecture decision, and Flovet approves each one. No feature or execution starts until the decisions behind it are logged in `docs/decisions/` and approved.
- Phase plans never edit this brief. Only a decision Flovet has approved changes it.
- Later features may shape design choices (e.g. leave room in the schema), but are not built early.

## Full feature scope

Tags: **[data]** = needs a data source we don't have yet; decide before building.

### Must have

1. Accounts: sign up, log in, profile
2. Swipe-to-rate deck: move between anime cards with quick actions
3. Statuses: Watched, Watching, On hold, Dropped
4. Watchlist: a separate toggle, not a status
5. 5-star rating with half stars
6. Like a title, with a public like count
7. Episode progress
8. Episode ratings (optional)
9. Auto-filled start and finish dates
10. Title language toggle (English, romaji, native)
11. Advanced search (title in any language, genre/tags, studio, year, format)
12. Studio pages; character and staff pages **[data]**
13. "Currently watching" section on the profile
14. Top 4 favourites on the profile
15. Lists: public, private and unlisted
16. Clone someone's list
17. Franchise grouping
18. Import a user's MAL or AniList list from an exported file (file parsing only, no API)
19. Stats: hours, genres, studios, score spread
20. Shareable stat cards
21. Reviews with spoiler tags
22. Block, report and moderation
23. NSFW filter
24. Dark mode
25. Trending, top rated and seasonal charts (trending from our own users' activity)
26. Milestone badges for ratings, Watched and approved contributions, announced on any page when earned (0024)
27. Community contributions: users suggest data changes and an admin validates them before they go live; ships with the admin dashboard (0026)
28. AniKansou rating: a public per-title rating from our users' star ratings, with the dataset's score from other sites as a labelled stand-in until a title has enough ratings (0025)

### Nice to have

26. Likes and threaded comments
27. Follow users
28. Activity feed
29. Notifications
30. Where-to-stream links **[data]**
31. Airing calendar **[data]**
32. Sub vs dub logging
33. Hidden gems filter
34. Random pick from the watchlist
35. Yearly watch goal

### Can wait

36. Franchise watch-order guides
37. Head-to-head "which is better" ranking
38. Polls and trivia
39. Auto-translated reviews and comments

## Stack

- Next.js 16 (App Router, TypeScript strict), Tailwind + shadcn/ui, Supabase (Postgres, Auth, Storage, RLS), Vercel.
- No separate backend, no ORM, no Redis.

## Data sources and licences

- Only source: anime-offline-database, cedya77 fork (https://github.com/cedya77/anime-offline-database).
- Licence: ODbL 1.0 + DbCL 1.0. Credit both cedya77/anime-offline-database and manami-project/anime-offline-database (archived original).
- Forbidden: any external anime API (AniList, MyAnimeList, Jikan, Kitsu, AniDB, TMDB, TheTVDB, etc.) and any paid API, with one exception: AniList's API for cover images of titles on screen (decision 0017).
- Images (decision 0008): posters come from `catalog.anime_images`, ranked in-house → TMDB (links added by hand, non-commercial, credited) → AniList (on since 0017: looked up server-side only for titles about to be shown, link stored, without AniList's written permission, a risk Flovet accepted) → the generated fallback poster. Dataset image URLs are still never hotlinked, and no other image API is called.

## Design direction

References are for inspiration only: never copy their logos, names, icons, illustrations or exact brand colours.

- **Layout, like Duolingo or X:** on desktop, a fixed left sidebar for navigation, one central content column, and an optional right rail (progress, suggestions). On mobile, a bottom tab bar with the central column full width. Few top-level sections, always visible.
- **Style, like Crunchyroll:** dark theme first; a single warm, vivid accent colour on near-black surfaces; bold, poster-forward cards; strong type hierarchy; artwork leads, chrome stays quiet.
- **Features borrowed from Letterboxd:** half-star ratings, likes, a watchlist, a diary of watch dates, reviews, lists, top 4 favourites and stats / year in review.
- **Gamified feel, like Duolingo:** quick, satisfying actions, light celebrations and visible progress, without guilt mechanics.
- **No generic UI.** The product must never look like a default shadcn/ui or Tailwind template. Library components are a base for behaviour and accessibility only; restyle them fully with our tokens, and build custom components wherever the design references call for it.
- **The product team researches, then decides.** Before making any product, UX, UI or architecture decision, the product team researches how the references above solve the same problem (product-team skill, Step 1). The decision, its research and Flovet's approval are logged in `docs/decisions/`, and every completed task is reviewed against them (Workflow E).

### Icons

- Use **icons-animated** (https://icons.lndev.me/, repo: ln-dev7/icons-animated), MIT licence, React components built on Motion.
- Install through its shadcn registry (`pnpm dlx shadcn add @icons-animated/<set>-<icon>`), so Motion versions stay pinned as the library requires.
- Use **one icon set** from it across the whole product for visual consistency (set to be chosen: Hugeicons, Tabler, Phosphor or Heroicons).
- Animate on interaction only (hover, press, state change such as like or watchlist), never constantly; respect `prefers-reduced-motion`.
- Icons are decorative (`aria-hidden`); the button or link around them carries the accessible label.
- Keep the library's `LICENSE` and `THIRD_PARTY_NOTICES.md` notices in the repo.
- Don't mix in other icon libraries (replace shadcn's default lucide icons over time).

## Decisions (newest first)

Product-wide decisions only. Every decision, with its research, is logged in `docs/decisions/`.

- 2026-11-11: Milestone badges for ratings, Watched and approved contributions, stored and announced once on any page; no points, no likes, no streaks or leaderboards (0024).
- 2026-11-11: Our own public AniKansou rating from users' star ratings, shown from 10 ratings; until then the dataset's score is shown, labelled as from other sites. This amends "never shown to users" below; the deck order stays private (0025).
- 2026-11-11: Community contributions validated by an admin, shipping with the admin dashboard. Data from APIs that don't allow copying is never stored or edited, except AniList cover links (0017) (0026).
- 2026-11-07: Title search on Discover (`/discover`) across every title and synonym, in any script; filters come later (0018).
- 2026-11-07: AniList cover images, looked up only for titles on screen and stored as links; written permission not yet obtained (0017).
- 2026-11-07: Library at `/library` with status, watchlist and liked shelves (0016).
- 2026-11-07: The deck offers Watched only, and a rating needs Watched (0015).
- 2026-11-06: Design system approved (`docs/design/design-brief.md`, decisions 0001–0007): Kohaku amber accent on warm near-black, Bricolage Grotesque + Onest, a colour and icon per action and status, 2:3 title cards with the title beneath, responsive sidebar/bottom-tab shell, Hugeicons, generated fallback posters. Artwork source decided in 0008 (see below).
- 2026-11-06: Posters: ranked image sources (in-house, TMDB, AniList off until permitted) with the generated poster as the last fallback (0008).
- 2026-11-06: The product team researches and makes every decision; Flovet approves each one before anything is built. Decisions are logged in `docs/decisions/`, and Workflow E reviews completed work against them.
- 2026-11-06: Every feature ships with tests (unit, integration and e2e as the spec requires).
- 2026-11-06: Icons come from icons-animated, one set only.
- 2026-11-06: No generic library look; custom components where needed.
- 2026-11-06: Research before every product/UX/UI decision; the product-team skill reviews every completed agent task (Workflow E).
- 2026-11-05: Watchlist is a separate toggle, not a status.
- 2026-11-05: Statuses are Watched, Watching, On hold, Dropped.
- 2026-11-05: Like works without a rating.
- 2026-11-05: The swipe deck is ordered by the dataset's aggregated score internally; that score is never shown to users.
- 2026-11-05: Agent workflow: one builder agent at a time; scouts for research and prototypes; a reviewer subagent on every diff.
- 2026-11-04: Data rules: own bigint IDs; external IDs in a generic mapping table; never hard-delete anime (retire + redirects); one active source per data type, extra sources only fill gaps; community overrides never overwritten; ODbL data in its own `catalog` schema; imports pinned to a release tag, staged, hash-diffed and logged.

## Domain rules and vocabulary

- Rating: stored as integer 1–10 (half stars), shown as 0.5–5 stars.
- Titles: romaji by default.
- `user_anime` (one row per user + anime) plus append-only `user_anime_events`.

## Constraints

- No paid APIs or services beyond hosting basics.
- No custom domain yet; production runs on the Vercel URL.
- WCAG 2.2 AA; mobile first; dark mode first.
- Legal check on the crawled-data question before monetizing.

## Active roles

- All ten. Gamification stays light and positive: progress and celebrations, no guilt mechanics.
