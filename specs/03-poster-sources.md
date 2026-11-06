# 03: Poster sources

Status: Done (PR #8, merged 2026-11-06)

Brief: Images (decision 0008). This task builds the data layer for title posters: where poster images are recorded, how sources are ranked and switched off, and how the app reads them. No page shows posters yet; the poster component comes with the design foundations.

## Goal

Every anime can have poster images from several sources. Readers get them best first, so the UI can show the first one that loads and fall back to the generated poster. Sources can be switched off instantly, and no image can point at a host its source doesn't own.

## Decisions

Implements [0008](../docs/decisions/0008-artwork-source.md). Respects [0004](../docs/decisions/0004-placeholder-poster-art.md) (the generated poster is the fallback, built later).

## Acceptance criteria

### Database (one new migration)

1. `catalog.image_sources`: `id`, `slug` (unique), `name`, `url_prefix` (nullable; null means the source stores Storage paths, not links), `priority` (unique), `is_enabled`, `attribution`, `created_at`. Seeded with:

   | slug      | priority | is_enabled | url_prefix                      |
   | --------- | -------: | ---------- | ------------------------------- |
   | `inhouse` |       10 | true       | null (Storage bucket `posters`) |
   | `tmdb`    |       20 | true       | `https://image.tmdb.org/t/p/`   |
   | `anilist` |       30 | **false**  | `https://s4.anilist.co/`        |

2. `catalog.anime_images`: `id`, `anime_id` (references `catalog.anime`, on delete cascade), `kind` (`poster` only for now, enforced by a check), `source_id` (references `image_sources`), `url` (nullable), `storage_path` (nullable), `external_ref` (nullable, e.g. `tv/12345` for TMDB), `width`, `height` (nullable, positive), `status` (`active` or `broken`, default `active`), `note`, `created_at`, `updated_at`.
   - Exactly one of `url` and `storage_path` is set, and it matches the source: link sources take a `url` starting with their `url_prefix`; Storage sources take a `storage_path` (no leading slash, no `..`). Enforced in the database (trigger), not only in code.
   - One image per anime, kind and source (unique).
   - Indexed on `anime_id` and `source_id`.
3. `catalog.poster_candidates`: a `security_invoker` view of active posters from enabled sources, with `anime_id`, `source` (slug), `priority`, `url`, `storage_path`, `width`, `height`. Readers order by `priority`.
4. **RLS and grants:** RLS on both tables. `anon` and `authenticated` may `select` `image_sources`, `anime_images` and the view, and nothing else. The `anime_images` read policy only returns rows that are `active` and whose source is enabled, so switching a source off hides its images even from direct table reads. No insert, update or delete for API roles.
5. `updated_at` is set on update.
6. The catalog import code (`src/sync/`) is not changed, and the import never touches these tables.

### App code

7. `src/features/posters/resolve.ts` (pure): turns candidate rows into an ordered list of image URLs. Storage paths become public Storage URLs on `NEXT_PUBLIC_SUPABASE_URL` (`/storage/v1/object/public/posters/<path>`, path segments URL-encoded). Drops duplicates and anything that isn't `https`. Returns an empty list when there are no candidates (the UI then shows the generated poster).
8. `src/features/posters/queries.ts` (server-only): `getPosterSources(animeIds)` reads `catalog.poster_candidates` with the public client and returns a `Map` from anime id to its ordered URLs. Empty input makes no request. At most 100 ids per call.
9. `src/types/database.types.ts` is regenerated from the Supabase project after the migration is applied.

### Docs

10. `supabase/README.md`: the two tables and the view in "What's in catalog", and how to add an in-house or TMDB poster by hand (SQL), including turning a source on or off.

## Out of scope

- Any UI: the poster component, `next.config` image hosts, attribution on the About page (they come with the design foundations and title card specs).
- An upload form or admin role for in-house posters.
- Any call to TMDB, AniList or another API, and any job that fills `anime_images` automatically.
- Turning AniList on (needs AniList's written permission and a new decision).
- Banners or other image kinds.

## Edge cases

- An anime with only images from a disabled source: no candidates.
- A `broken` image: hidden, while other sources still show.
- A link with the right host but `http://`, or a prefix look-alike (`https://image.tmdb.org.evil.test/...`): refused.
- A Storage path with `..` or a leading `/`: refused.
- A row that sets both `url` and `storage_path`, or neither: refused.
- Changing a source's `url_prefix` while it has images: refused (follow-up migration `20261106130000_image_sources_lock_prefix.sql`, from the review).
- A retired anime keeps its images (it may be revived); readers filter retired anime as they already do.
- Ids passed to `getPosterSources` that have no images: absent from the map.

## Files and patterns to follow

- Migration: `supabase/migrations/<timestamp>_anime_images.sql`, following the catalog migration's RLS conventions (RLS on, roles named on every policy, explicit grants after `revoke`).
- Database tests: PGlite through `src/sync/fixtures/test-db.ts`, as in `src/sync/run.test.ts` (`set role anon` to test RLS). Put them in `src/sync/anime-images.test.ts`, since `@/sync` can't be imported from app code.
- App code: `src/features/posters/`, like `src/features/profiles/` (`server-only` queries, pure helpers with unit tests beside them).

## Boundaries

- **Always:** RLS and grants in the same migration; database checks for every rule above; show evidence for each check.
- **Ask first:** applying the migration to the Supabase project; any new dependency or environment variable.
- **Never:** edit an applied migration; call an image or anime API; let `anon` see images from a disabled source; touch `src/sync/` import logic.

## Manual steps for Flovet

1. Create a **public** Storage bucket named `posters` (Supabase > Storage > New bucket) before adding in-house posters.
2. Email contact@anilist.co for permission to show AniList cover images (see 0008).

## Check

**Commands that must pass:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Tests:**

- Database (PGlite): seeded sources and order; prefix check accepts a TMDB link and refuses wrong hosts, look-alike hosts and `http`; Storage path rules; exactly-one-of `url`/`storage_path`; unique per anime, kind and source; `anon` sees active rows from enabled sources only, through the table and the view; disabling a source hides its rows; `anon` can't insert, update or delete; `updated_at` changes on update.
- Unit: `resolve` orders by priority, builds Storage URLs with encoding, drops duplicates and non-https links, returns `[]` for none.
- Unit: `getPosterSources` makes no request for an empty list and rejects more than 100 ids.
