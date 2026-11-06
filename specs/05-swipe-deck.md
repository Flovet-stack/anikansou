# 05: Swipe-to-rate deck

Status: Done (built 2026-11-06 on branch claude/swipe-deck; decisions 0009–0012 and 0014 approved) · Written: 2026-11-06

Brief: Must have #2 (swipe-to-rate deck), with the parts of #3 (statuses), #4 (watchlist), #5 (half-star rating) and #6 (like) that the deck needs. This is the product's core loop and differentiator: "a fast, gamified swipe-to-rate experience".

## Goal

A signed-in fan opens **Rate** and moves through anime, best-known titles first. On a phone or tablet they swipe: "seen it" (and rate it in one tap), "not seen" or "want to watch". On the web, swiping only moves between anime, and status, rating, like and watchlist are one-click controls beside the poster. Either way they can like titles and undo mistakes. Everything they do is saved to their tracking data, so later features (library, profile, stats) can build on it.

## Decisions

Implements [0009](../docs/decisions/0009-swipe-deck-interaction.md) (touch and web models, rating step, undo, motion, unaired titles, progress), [0010](../docs/decisions/0010-deck-content-and-order.md) (eligibility including unaired and adult titles, order, private scores, card content) and [0011](../docs/decisions/0011-tracking-data-model.md) (`user_anime` and events), with the deck order from [0014](../docs/decisions/0014-deck-order.md) (aired first, small samples damped), which replaces 0010's order. Follows [0002](../docs/decisions/0002-app-shell-and-navigation.md) (the Rate nav item ships with this spec), [0004](../docs/decisions/0004-placeholder-poster-art.md), [0005](../docs/decisions/0005-status-and-action-colours.md), [0007](../docs/decisions/0007-interaction-and-disclosure.md) and [the design brief](../docs/design/design-brief.md).

**Depends on:** [spec 04](04-ui-refresh.md) (tokens, shell, `PosterArt`, restyled base components) and [spec 03](03-poster-sources.md) (`getPosterSources`). Both merge first. Decisions 0009–0012 and 0014 are approved.

## Acceptance criteria

### Database (new migrations; schema change approved through 0011)

1. `public.watch_status` enum, `public.user_anime` and `public.user_anime_events` exactly as 0011 describes, with RLS, role-scoped policies using `(select auth.uid())`, column privileges, the `updated_at` trigger and the indexes listed there.
2. **Write functions:** one database function per action, each writing the state change and its event in one transaction, and deleting the `user_anime` row when it ends up empty:
   - `set_status(anime_id, status)` (status nullable to clear),
   - `set_rating(anime_id, rating)` (1–10, or null to clear; a rating with no status also sets Watched, per 0009),
   - `set_watchlist(anime_id, on)`,
   - `set_like(anime_id, liked)`,
   - `deck_seen(anime_id, status, rating)` (touch "Seen it": status and optional rating in one call),
   - `deck_skip(anime_id, via)` (`via` is `not_seen` on touch or `passed` on the web; recorded as a `deck_skipped` event with that value),
   - `deck_undo(event_id)`: reverses that event's effect for the caller only, records an `undone` event, and refuses events that aren't the caller's or are already undone.
     All run as the caller (`security invoker`), validate inputs in the database, and are executable by `authenticated` only. **Status and rating writes are refused for `upcoming` anime** (0009, 0010).
3. **`deck_next(cursor, page_size)`** per 0010: `security definer`, `set search_path = ''`, `authenticated` only, page size 1–20. Applies every eligibility rule in 0010, orders as 0014 describes (from a private, precomputed view), returns the listed fields plus an opaque cursor and **never the score**. It also returns `is_upcoming` and `is_adult` flags. The adult-tag list is checked against the live catalog and written into the migration with a comment.
4. `EXPLAIN ANALYZE` of `deck_next` for a user with 0 and with 2,000 tracked titles is pasted into the PR; both under 50 ms on the Supabase project.
5. `src/types/database.types.ts` regenerated from the project.

### Route and access

6. `/rate` lives in the `(app)` shell. The proxy matcher and rules add `/rate` the same way as `/settings`: signed out goes to `/auth/login?next=/rate`, no username goes to `/auth/username?next=/rate`. (Proxy change approved through this spec's approval.)
7. The **Rate** nav item (star icon) appears in the sidebar, rail and bottom tab bar, first in order, with `aria-current="page"` on `/rate`. Signed-out visitors see it too and are sent to log in.
8. Per 0009 "Entry point": after the username step, and when a signed-in user opens `/auth/login` or `/auth/sign-up`, the default destination is `/rate` instead of `/settings` (an explicit `next` still wins). The accounts e2e test is updated to match.

### The deck

9. **Card content** per 0010 (shared by both models): poster (`PosterArt` with URLs from `getPosterSources`, fallback otherwise), title (25 px, up to 3 lines), meta line, studio and season line, up to 3 tag chips, the like heart (0005 rose when on). Upcoming titles carry an "Upcoming" badge; adult titles carry an "18+" badge and a blurred poster until revealed (one click or tap, remembered for the session). No score anywhere.
10. **Model by input type** per 0009: touch model on `(pointer: coarse)`, web model on `(hover: hover) and (pointer: fine)`, re-checked when the input type changes. Both share the same data, undo stack and card content.
11. **Web model** per 0009: poster left with Previous/Next arrow buttons, details and the actions panel right. Drag left/right, the arrows, ←/→ and J/K move between anime; nothing is saved by moving except the "passed" record when moving forward past an untouched anime. The actions panel (rating, the four statuses, like, watchlist) saves on each click, with the keys in 0009; clicking an active value clears it; nothing auto-advances. Previous returns through every anime seen this session, passed ones included, with their saved state and all controls active; acting on a passed anime saves normally and clears its "passed" record (0009).
12. **Touch model** per 0009: the gesture table with its buttons and keys, thresholds, the 30° rule for up, live drag labels in the 0005 colours, spring-back below threshold, and buttons in the bottom third of the screen with 44 px+ targets. The rating step: half-star control, status row (Watched preselected), like heart; tapping a star saves and advances; "Save without rating"; "Back".
13. **Unaired titles** per 0009: no rating or status controls on the web (a "Not aired yet" line instead); on touch "Seen it" is hidden and a right swipe springs back with "Not aired yet". Like, watchlist and moving on work as usual.
14. **Undo** per 0009: unlimited within the session, from the toast, Ctrl/Cmd+Z, and on touch the Undo button and Z. On touch the undone card returns to the top; on the web the controls show the previous state.
15. **Optimistic UI:** the result shows immediately (the next card on touch, the control state on the web); the save runs in the background. On failure the card comes back with an inline error and a "Try again" action; nothing is silently lost.
16. **Prefetch:** keeps at least 5 cards ready; fetches the next page when 3 remain; preloads the next 2 posters.
17. **Progress and celebration** per 0009: session counter, ring toward the next milestone (10, 25, 50, 100 total ratings), short accent burst and one-line message at a milestone. On desktop (≥ 1280 px) the counter and ring sit in the right rail; on smaller screens, above the card.
18. **Motion** per 0009 and 0001 tokens, built on Motion (pinned with 0003): touch: 1:1 drag with up to 8° rotation, fly-out under 250 ms, next card scales from 0.96; web: horizontal slide with no rotation, under 250 ms. Keyboard and button actions fade instead of throwing. Reduced motion: no rotation or fly-out, 120 ms cross-fades, no burst.
19. **First-run hints** per 0009 (touch: the nudge; web: the one-time "Next" pulse), remembered in local storage (no schema change), so it can show once more on a new device.

### States

20. **Loading:** a card-shaped skeleton (no spinner). **Empty** (nothing left): "You've been through everything for now. Titles you skipped or passed come back in 30 days." with the session count and no other links (no other sections exist yet). **Error:** what happened and a "Try again" button. **Offline:** actions are refused with a clear message rather than queued.

### Accessibility

21. The deck works with keyboard only and with a screen reader without any gesture: each card is announced with title, type, year and episodes; actions are buttons with names; the result of each action is announced through a polite live region ("Rated 4.5 stars. Next: Mushishi").
22. Focus stays on the deck controls after each action; it never jumps to the top of the page.
23. WCAG 2.5.1 and 2.5.7 are met (buttons for every gesture); all text and icons meet 0001/0005 contrast.

### Tests

24. **Database tests** (`pnpm test:db`): RLS for both tables with two users (zero rows visible to the other, writes refused); rating bounds; empty-row deletion; every write function records exactly one event; status and rating writes are refused for upcoming anime; a rating with no status sets Watched; undo restores the previous state and refuses another user's event; `deck_next` never returns the score, includes upcoming and adult titles with the right flags, excludes specials, retired, acted-on and recently skipped or passed titles, includes liked-only titles, and returns skipped titles after 30 days.
25. **Unit tests:** input-model selection, gesture classification (threshold, velocity, the 30° rule), undo stack, prefetch trigger, milestone logic, which controls an upcoming title gets.
26. **E2E, web model (desktop Chrome):** sign up, land on `/rate`, rate one anime 4.5 stars with the panel, set another to Watching, like one, add one to the watchlist, move past one untouched, go back with Previous to the passed one and rate it (it must then count as rated, not passed), go back to a saved one and see its state, undo one action, reload and confirm the saved state survived and acted-on or passed anime don't come back. A keyboard-only run of the same flow. An upcoming title shows no rating or status controls.
27. **E2E, touch model (mobile emulation with touch, 390 px):** swipe right and rate, swipe left, swipe up, undo; an upcoming title springs back on a right swipe; an adult title's poster is blurred until tapped.

## Out of scope

- Library, profile, diary, stats and title pages (the saved data waits for them).
- Episode progress, start and finish dates, episode ratings, reviews.
- Deck filters (genre, year, format), search, personalised ordering.
- The NSFW setting (adult titles are badged and blurred, per 0010, until its own decision).
- Public like counts and anything visible to other users.
- Importing MAL/AniList lists.

## Edge cases

- Two tabs open: an action in one doesn't break the other; `deck_next` excludes what was saved, and a duplicate action on the same card is harmless.
- Undo after the page reloads: only the toast's Undo for the latest action survives a reload; the session stack resets (documented in the UI by the toast's lifetime).
- A title retired by an import while it's in the prefetched queue: the save is refused cleanly and the card is dropped.
- Very long titles (3-line clamp with full title in the accessible name) and titles with no native title or no tags.
- Rapid repeated swipes or arrow presses: actions apply in order; the deck never shows the same card twice.
- An anime goes from upcoming to airing between imports: its controls appear on the next load.
- On the web, clearing a rating leaves the status as it was; clearing everything deletes the row (0011).
- A rating of 0.5 stars (stored as 1) and 5 stars (10).

## Files and patterns to follow

- Feature folder: `src/features/deck/` (components, hooks, actions) and `src/features/tracking/` (types, server actions wrapping the database functions, schemas). Follow `src/features/profiles/` for action and schema structure.
- Migrations in `supabase/migrations/`, following `20261106015631_profiles.sql` for RLS, privileges and trigger style.
- Page: `src/app/(app)/rate/page.tsx`, request data behind `<Suspense>` with `connection()` as in Settings.
- Proxy: `src/proxy.ts` matcher and `src/lib/supabase/proxy.ts` rules.
- Posters: `PosterArt` from spec 04, `getPosterSources` from spec 03.
- Read the Next.js docs in `node_modules/next/dist/docs/` for server actions and caching in this version before writing code (AGENTS.md).

## Boundaries

- **Always:** keep the score server-side; write state and event together; every gesture has a button and a key; use tokens and the 0005 state colours only for their meanings.
- **Ask first:** any dependency beyond Motion; any change to the catalog schema or the import; any auth change other than adding `/rate` to the proxy rules.
- **Never:** show or return the aggregate score or a value that reveals it; call any external anime API; load images from hosts spec 03 doesn't allow; add streaks, timers or guilt messages.

## Check

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm build` all pass.
- `EXPLAIN ANALYZE` output for `deck_next` in the PR.
- A screen recording (or GIF) of the deck at 390 px with touch swipes, and screenshots at 1440 px (dark), including the rating step, a milestone and the empty state.
- Workflow E review against this spec and decisions 0002, 0004, 0005, 0007, 0009, 0010 and 0011, posted on the PR.
