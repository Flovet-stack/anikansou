# 0011: Tracking data model (user_anime and events)

- **Status:** Approved
- **Proposed:** 2026-11-06 by the product team (roles: Database, Backend, Tech Lead, Product)
- **Approved:** 2026-11-06 by Flovet ("0011 makes sense"); this also approves the schema change
- **Specs:** specs/05-swipe-deck.md

## Context

The deck is the first feature that saves per-user tracking data. The brief already fixes the shape: "`user_anime` (one row per user + anime) plus append-only `user_anime_events`"; rating "stored as integer 1–10 (half stars), shown as 0.5–5 stars"; statuses Watched, Watching, On hold, Dropped; watchlist is a separate toggle; like works without a rating. Later features (episode progress, auto-filled dates, diary, stats, public like counts) will read the same tables, so the columns are decided now, even though the deck uses only some of them.

## Research

| Reference                                                   | What they do                                                                                        | Adopt / adapt / reject | Why                                                                            |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| Our brief and `src/features/tracking/README.md`             | One current-state row plus an append-only history; watchlist and like independent of status         | Adopt                  | Already approved                                                               |
| Letterboxd (team knowledge)                                 | Diary entries are separate from the film's current rating, like and watchlist state                 | Adopt                  | Events give us the diary later without changing the current-state row          |
| Supabase RLS guidance (product-team skill, Database Expert) | RLS on every exposed table, policies scoped to roles, `(select auth.uid())`, indexed policy columns | Adopt                  | Same pattern as `profiles` (spec 02)                                           |
| Event sourcing only (no current-state row)                  | Rebuild state from events on read                                                                   | Reject                 | Every page would have to fold events; the current-state row keeps reads simple |

Sources: `PROJECT_BRIEF.md`, `src/features/tracking/README.md`, `supabase/migrations/20261106015631_profiles.sql` (existing RLS pattern).

## Decision

Proposed: two tables in `public`, written only through server actions as the signed-in user.

### `public.user_anime` (current state)

| Column                     | Type                                                              | Rule                                       |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| `user_id`                  | uuid                                                              | references `auth.users`, on delete cascade |
| `anime_id`                 | bigint                                                            | references `catalog.anime`                 |
| `status`                   | enum `watch_status` (`watched`, `watching`, `on_hold`, `dropped`) | nullable                                   |
| `rating`                   | smallint                                                          | nullable, 1–10                             |
| `liked`                    | boolean                                                           | not null, default false                    |
| `watchlisted`              | boolean                                                           | not null, default false                    |
| `created_at`, `updated_at` | timestamptz                                                       | `updated_at` set by trigger                |

- Primary key `(user_id, anime_id)`; index on `anime_id` (for like counts later).
- A row with every field empty (no status, no rating, not liked, not watchlisted) is deleted, so "no row" always means "no opinion".

### `public.user_anime_events` (append-only history)

| Column                | Type                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | bigint identity                                                                                                                                       |
| `user_id`, `anime_id` | as above                                                                                                                                              |
| `kind`                | enum: `status_set`, `status_cleared`, `rated`, `rating_cleared`, `liked`, `unliked`, `watchlist_added`, `watchlist_removed`, `deck_skipped`, `undone` |
| `value`               | jsonb (e.g. `{"status":"watched"}`, `{"rating":9}`)                                                                                                   |
| `source`              | text: `deck` for now                                                                                                                                  |
| `created_at`          | timestamptz                                                                                                                                           |

- Index on `(user_id, created_at desc)` and a partial index on `(user_id, anime_id, created_at)` where `kind = 'deck_skipped'` (the deck's 30-day exclusion).
- `undone` records point at the event they reverse (`value.event_id`), so history stays honest instead of being rewritten.

### Access

- RLS on both tables. `authenticated` can `select`, `insert`, `update` and `delete` only their own `user_anime` rows, and `select` and `insert` only their own events (no update or delete: append-only). `anon` gets nothing for now; public profiles and like counts come with their own decisions.
- Column privileges restrict writes to the user-editable columns, as in `profiles`.
- Each action writes the state change and its event in one transaction, through a `security invoker` database function or a single server action using one RPC, so they can't drift apart.

## Consequences

- Schema change: needs Flovet's OK under `CLAUDE.md` "Ask first" (approving this decision counts).
- Episode progress, start and finish dates and reviews add columns or tables later; nothing here blocks them.
- Reviews check: RLS tested with a second user (zero rows visible, writes refused); rating outside 1–10 refused by the database; the empty row is deleted; every state change has exactly one event.
