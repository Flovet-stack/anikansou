# 01: Catalog import

Status: Done (PR #5, merged 2026-11-06) · Written: 2026-11-05 · Pinned release: `2026-44`

## Goal

Load the anime-offline-database (cedya77 fork) into a `catalog` schema in our Supabase Postgres, following the data rules in `PROJECT_BRIEF.md` and `src/sync/README.md`. Every later feature (swipe deck, search, tracking, studio pages) reads from this catalog, so it must have stable IDs that survive weekly releases, be safe to re-run, and be readable but never writable by the public.

This task builds the schema, the importer and the two GitHub workflows. It builds no pages and no search API.

## Decisions for this task

| Decision                 | Choice                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How the pinned tag moves | A weekly workflow opens a PR that bumps the pinned tag and sha256. Merging it to `main` runs the import. A manual run re-imports the pinned tag.                                                                            |
| Database access          | Direct Postgres over `DATABASE_URL` (Supabase **session pooler**, port 5432). This replaces the "secret key" note in `src/sync/README.md`. A single transaction and `COPY` are not possible through the REST API.           |
| Driver                   | `postgres` (porsager), approved as a new dependency. No other new dependencies.                                                                                                                                             |
| Studios                  | One studio per normalized key (lowercase, corporate suffixes such as `inc.`, `co.`, `ltd.`, `corporation` and surrounding punctuation stripped). Every raw spelling is kept as an alias. Override aliases fix false merges. |
| TypeScript runtime       | Node 24 runs `src/sync/*.ts` directly (type stripping). No `tsx`, no build step.                                                                                                                                            |
| Aggregated score         | Stored, but in a table the public roles cannot read (brief: the score orders the deck and is never shown).                                                                                                                  |

## Facts about the dataset (checked on release `2026-44`)

- Asset: `anime-offline-database.jsonl` at `https://github.com/cedya77/anime-offline-database/releases/download/2026-44/anime-offline-database.jsonl`, sha256 `3e5165102de3423feb0d2ba043090584aedf3bf4029ed9b618bfcd58c1253e1a` (GitHub publishes a `digest` per release asset). About 61 MB.
- Line 1 is metadata (`$schema`, `license`, `repository`, `lastUpdate`), not an anime. The `$schema` URL contains the release tag.
- 38,337 anime. 239,521 synonyms. 3,139 distinct tags. 3,002 distinct raw studio names. 449,917 `relatedAnime` URLs.
- **Entries have no stable ID.** An entry is identified only by its `sources` URLs. In this release, no source URL appears in more than one entry.
- `relatedAnime` holds provider URLs, not dataset entries. Relations are untyped (no sequel/prequel).
- Sentinels: `episodes: 0`, `season: "UNDEFINED"`, `type: "UNKNOWN"`, `status: "UNKNOWN"`, and a missing `year`, `duration` or `score`.
- 199 main titles are shared by more than one entry (e.g. `ajin`), so a title is never an identity key.
- Tags are not curated. `picture` and `thumbnail` point to third-party CDNs (brief: never hotlink).
- Tags are not always weekly (`2026-41` is missing), and there is a non-dataset `fillers` release. The bump job picks the newest tag matching `^\d{4}-\d{2}$` that has the `.jsonl` asset.

## Acceptance criteria

### Schema (one new migration)

1. A `catalog` schema holds every table below. Every table has RLS enabled in the same migration. `catalog` holds ODbL data only, so no user data lives here.
2. `catalog.anime`: our own `bigint` identity `id`. Main title, type, episodes, status, season, year and episode duration in seconds. Dataset sentinels are stored as `NULL`. Also `content_hash`, `first_seen_run_id`, `last_seen_run_id`, `retired_at`, `created_at` and `updated_at`. Rows are never deleted.
3. `catalog.external_ids`: `(site, external_id)` is unique and maps to one `anime_id`. `site` and `external_id` are derived generically from each `sources` URL (normalized host, then path), and the original URL is stored too. No provider name is hardcoded anywhere in the code.
4. `catalog.anime_titles`: one row per title (the main title plus each synonym), with `kind` (`main` or `synonym`), a nullable `lang` left empty for later, and a `search_text` normalized by the importer (NFKC, lowercase). A `pg_trgm` GIN index sits on `search_text`.
5. `catalog.studios` (unique normalized `key`, display `name`), `catalog.studio_aliases` (unique `raw_name`, `source` = `import` or `override`), and `catalog.anime_studios` with `role` = `studio` or `producer`.
6. `catalog.tags` (unique name) and `catalog.anime_tags`.
7. `catalog.anime_relations`: directed `(anime_id, related_anime_id)` pairs, resolved from `relatedAnime` URLs through `external_ids`. URLs that don't resolve are counted in the run log, not stored.
8. `catalog.anime_redirects`: `from_anime_id` (PK) → `to_anime_id`, with a reason (`merged`) and the run that created it.
9. `catalog.data_sources`: slug, name, URL, licence, attribution text, data type, `is_active` and priority. A partial unique index allows only one active source per data type. The migration seeds the cedya77 row with the attribution text from `README.md`, crediting both cedya77 and manami-project.
10. `catalog.import_runs`: source, release tag, sha256, trigger (`schedule`, `push` or `manual`), git commit, start and finish times, status (`running`, `succeeded` or `failed`), counts (inserted, updated, unchanged, retired, revived, merged, split, unresolved relations) and an error message.
11. `catalog.overrides`: `(anime_id, field)` is unique, with the value as `jsonb`, a reason, an author and a timestamp. The importer never writes, updates or deletes rows here or in `studio_aliases` where `source = 'override'`.
12. `catalog.anime_scores` (anime_id, arithmetic geometric mean, arithmetic mean, median) and `catalog.anime_source_records` (anime_id, raw entry `jsonb`, hash): service-only, with no grants to `anon` or `authenticated`.
13. Staging tables live in the `catalog` schema and are service-only. They may be `UNLOGGED`, and each run truncates them.

### Access (RLS)

14. Public catalog tables grant `SELECT` to `anon` and `authenticated` through a read policy scoped to those roles. No role other than the importer's connection can insert, update or delete in `catalog`. Service-only tables (`anime_scores`, `anime_source_records`, staging, `import_runs`, `overrides`) have no policies and no grants for `anon` or `authenticated`.

### Import run

15. `pnpm sync:catalog` imports the release pinned in `src/sync/release.json` (`{ "tag": "...", "sha256": "..." }`). Changing the pin is a deliberate code change.
16. **Download and verify.** Fetch the `.jsonl` asset for the pinned tag, never `latest`. Abort if its sha256 differs from the pin.
17. **Validate before writing.** Line 1 must be metadata whose `$schema` contains the pinned tag and whose `repository` is the cedya77 repo. Every other line must pass a zod schema that mirrors `anime-offline-database.jsonl.schema.json` at that tag. Any invalid line fails the run before anything is written, and the error reports the line number.
18. **Stage.** Load validated rows into staging with `COPY`.
19. **Hash.** Each entry's hash is sha256 of its canonical JSON (sorted keys, and sorted values in every set-like array). Reordering the arrays in a source entry changes no hash.
20. **Match identity**, deterministically, by normalized source URLs against `external_ids`:
    - No match: a new anime.
    - One match: the same anime. Update it only if its hash changed, and sync its external IDs.
    - **Merge** (one entry matches several anime): keep the lowest `id`, retire the others, and add a redirect from each retired one to the one kept.
    - **Split** (several entries match one anime): the entry sharing the most URLs keeps the `id`. Ties go to the entry with the lexicographically smallest shared URL. The others become new anime.
    - An existing anime that matches no entry is **retired** (`retired_at` set). If its URLs come back in a later release, it is **revived** and keeps its `id`.
21. **Guard rails** (abort with a clear message unless the manual run sets `allow_large_change`): fewer than 30,000 entries; the count differs from the last successful run by more than 5%; more than 2% of active anime would be retired; or more than 1% would be merged.
22. **Apply in one transaction.** One transaction, under a Postgres advisory lock, writes all catalog tables and the `import_runs` row. If anything fails, the catalog is unchanged and a `failed` run row with the error is written separately.
23. **Idempotent.** Re-running the same tag inserts and updates nothing. Unchanged rows keep their `updated_at`, and the run records 0 inserted, updated, retired, merged and split.
24. Logs print each phase with timings and the final counts. No secret value is ever printed.

### GitHub workflows

25. `.github/workflows/catalog-import.yml` runs on `push` to `main` when `src/sync/release.json` changes, and on `workflow_dispatch` with an optional `allow_large_change` boolean. It uses Node 24 and pnpm, with secret `DATABASE_URL`. A `concurrency` group prevents overlapping runs and never cancels a run in progress.
26. `.github/workflows/catalog-release-bump.yml` runs weekly on a cron and on `workflow_dispatch`. It finds the newest weekly tag (see Facts). If that tag is newer than the pin, it opens or updates a single PR that changes only `src/sync/release.json` (tag and the asset's sha256) and links the release. It uses `GITHUB_TOKEN` with `contents: write` and `pull-requests: write`. Never auto-merge.

### Docs and config

27. `src/sync/README.md` is updated to match: `DATABASE_URL` instead of a secret key, the identity rules, guard rails, how to run locally, and that cache invalidation is deferred (no catalog pages yet).
28. `.env.example` documents `DATABASE_URL` (session pooler, server-only, never `NEXT_PUBLIC_`). The importer validates its own env with zod. `src/env.ts` is unchanged, because the Next app never connects to Postgres directly.
29. `src/types/database.types.ts` is regenerated for `public` and `catalog`.

## Out of scope

- Any page, route, search API or UI. No `tsvector` (it comes with the search spec).
- Slugs and slug redirects (anime pages spec). Redirects here are by anime `id` only.
- Franchise grouping and relation types (sequel, prequel and so on).
- Images: no picture URLs in public tables, no downloads. The raw entry is kept in `anime_source_records` for a later artwork decision.
- Title language labels (`lang` stays empty), and the English/romaji/native toggle.
- Moving user data on merges (there is no user data yet; the redirect table makes it possible later).
- Dead-entry files, the `fillers` release, other data sources, MAL/AniList file import.
- Cache invalidation, and attribution in the site UI.

## Edge cases

- A source URL moving from one entry to another between releases (a split plus a merge in the same run).
- Two entries with the same main title (199 in `2026-44`). Never dedupe by title.
- A synonym that equals the main title, or duplicate synonyms after normalization: store one row.
- Entries with no studio (15,880), no year (1,307) or no score (11,357).
- Non-Latin titles (e.g. `●● no Mahou`, Japanese synonyms) must survive NFKC and lowercasing, and stay searchable.
- `relatedAnime` pointing at the entry itself, or at a URL whose anime is retired.
- A download that is truncated or served as an HTML error page (caught by the sha256 check).
- The run dying halfway, such as a connection drop mid-transaction: nothing is applied, and the next run starts clean.
- Two runs started at once (advisory lock plus workflow concurrency).
- An override that points at an anime later merged away: keep the override, and report it in the run log.

## Files and patterns to follow

- `supabase/migrations/<timestamp>_catalog.sql`: the first migration. Follow the RLS conventions in `README.md` (RLS from the first migration, roles named on every policy).
- `src/sync/`: `release.json`, the entry point, and small modules for download, validate, canonical hash, identity matching and apply. Unit tests sit beside them as `*.test.ts`, with small JSONL fixtures in `src/sync/fixtures/`. Use relative imports with `.ts` extensions and erasable TypeScript only (no `enum` or `namespace`), so Node 24 can run it. Adjust `tsconfig.json` (`allowImportingTsExtensions`) if needed. ESLint already stops app code from importing `@/sync`. Keep that rule.
- `package.json`: add the `postgres` dependency and a `sync:catalog` script.
- `.github/workflows/`: the two workflows above. There is no CI workflow yet, so don't add one in this task.
- Read `node_modules/next/dist/docs/` only if something touches Next config (it shouldn't).

## Boundaries

- **Always:** pin the tag and sha256; validate before writing; one transaction; log the run; show evidence for every check below.
- **Ask first:** any dependency other than `postgres`; any change to `public` schema tables; any table or column not listed here; loosening a guard rail.
- **Never:** call any external anime API (the GitHub release download is the dataset itself, not an API); fetch `latest`; hard-delete an anime; write to `overrides`; expose `anime_scores` or picture URLs to `anon` or `authenticated`; put `DATABASE_URL` in client code or logs; edit this migration once it has been applied (add a new one).

## Manual steps for Flovet (the agent lists them and doesn't do them)

1. Add the `DATABASE_URL` repo secret: Supabase > Connect > **Session pooler** URI. The direct host is IPv6-only, and GitHub runners need IPv4.
2. Supabase > Settings > Data API: add `catalog` to the exposed schemas.
3. GitHub > Settings > Actions > General: allow GitHub Actions to create pull requests. PRs opened with `GITHUB_TOKEN` don't trigger other workflows, which is fine while there's no CI workflow.
4. Apply the migration (`pnpm dlx supabase db push` or the SQL editor) before the first import.

## Check

**Commands that must pass:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests (Vitest, no database):**

- The validator rejects a bad line and reports its line number, and rejects a metadata line from a different tag.
- The hash is stable when array order changes, and changes when a value changes.
- Identity matching on fixtures covers new, update, unchanged, merge, split, retire, revive and a self-referencing relation.
- Studio key normalization: `wit studio` and `wit studio, inc.` share a key; `mappa` and `mappa co., ltd.` share a key.

**End to end, against the Supabase project (paste the output in the PR):**

1. **Load:** after `pnpm sync:catalog` on `2026-44`, `select count(*) from catalog.anime where retired_at is null` = **38,337**, and the newest `import_runs` row is `succeeded` with 38,337 inserted.
2. **Idempotent:** a second run's `import_runs` row shows 0 inserted, updated, retired, merged and split, with 38,337 unchanged. `select count(*) from catalog.anime where updated_at > <second run start>` = 0. Table row counts are unchanged.
3. **Known titles** (looked up through `external_ids`, with values as in `2026-44`):

   | Title                                | Expect                                                                                                                                                                                                         |
   | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Sousou no Frieren                    | One anime: TV, 28 eps, Fall 2023, studio Madhouse. "2nd Season" (TV, 10 eps, Winter 2026) is a separate anime, and a relation links the two.                                                                   |
   | Attack on Titan (Shingeki no Kyojin) | Separate anime for S1 (2013, 25 eps), S2 (2017, 12), S3 (2018, 12), S3 Part 2 (2019, 10), The Final Season (2021, 16) and Part 2 (2022, 12). S1 to S3 Part 2 are Wit Studio; the Final Season parts are MAPPA. |
   | Hunter x Hunter                      | Two distinct anime: 1999 (TV, 62 eps, Nippon Animation) and 2011 (TV, 148 eps, Madhouse). A title search for `hunter x hunter` returns both.                                                                   |

4. **Trigram index:** `explain analyze` of a title search, e.g. `select anime_id from catalog.anime_titles where 'frieren' <% search_text`, shows a Bitmap Index Scan on the trigram index, not a Seq Scan. Sousou no Frieren is in the results.
5. **RLS:** using the publishable key (`anon`), a `select` on `catalog.anime` returns rows. An `insert`, `update` and `delete` on `catalog.anime` each fail. A `select` on `catalog.anime_scores` fails or returns nothing. Show the same with `set role anon` in SQL.
6. **Rollback:** a run forced to fail after staging (e.g. a fixture with an invalid line, or a guard-rail breach) leaves the catalog counts unchanged and writes a `failed` run row.
7. **Workflows:** a `workflow_dispatch` run of the import succeeds (link the run). A `workflow_dispatch` of the bump job either opens a PR or reports "already on newest tag" (link it).
8. The `reviewer` subagent reviews the diff against this spec, and there are no Critical or High findings.
