# Sync

The catalog importer. It loads one pinned release of [anime-offline-database](https://github.com/cedya77/anime-offline-database) (the cedya77 fork) into the `catalog` schema. The task spec is [specs/01-catalog-import.md](../../specs/01-catalog-import.md), and the schema is in [supabase/migrations](../../supabase/migrations). See the [Data source](../../README.md#data-source) section of the main README for the license and attribution.

Application code never imports from `@/sync`. ESLint enforces this.

## Running it

```bash
pnpm sync:catalog --dry-run   # validate, match and print the plan; writes nothing
pnpm sync:catalog             # import the pinned release
pnpm sync:catalog --file ./anime-offline-database.jsonl   # use a local copy (sha256 still checked)
pnpm sync:catalog --allow-large-change                    # apply despite a guard rail
pnpm sync:bump                # move the pin to the newest weekly release, if any
```

The importer needs `DATABASE_URL` in `.env.local` (locally) or as a repo secret (CI). Use the Supabase **session pooler** URI (Supabase > Connect > Session pooler, port 5432): it supports one long transaction and `COPY`, and it is reachable over IPv4, which GitHub runners need. The direct host is IPv6-only. The connection runs as `postgres`, so the importer is the only writer; everyone else gets read-only RLS. Never put it in client code or a `NEXT_PUBLIC_` variable.

Node 24 runs these files directly (type stripping), so there's no build step. Use relative imports with a `.ts` extension and erasable TypeScript only (no `enum` or `namespace`). `src/sync/package.json` marks the folder as ES modules.

## Pinned release

[release.json](release.json) holds `{ tag, sha256 }`. The importer never fetches `latest`. Changing the pin is a code change:

- **Weekly:** the _Catalog release bump_ workflow checks for a newer `YYYY-WW` release and opens a PR that changes only `release.json`. Merging the PR runs the _Catalog import_ workflow.
- **By hand:** run _Catalog import_ from the Actions tab to re-import the pinned tag, optionally with `allow_large_change`.

## Import run

1. **Download and verify.** Fetch `anime-offline-database.jsonl` for the pinned tag, and abort if its sha256 differs from the pin.
2. **Validate.** Line 1 must be metadata for the pinned tag from the cedya77 repository. Every other line must pass [schema.ts](schema.ts), which mirrors the dataset's JSON schema. Any invalid line fails the run, reporting its line number, before anything is written.
3. **Normalize and hash.** Map sentinels (`episodes: 0`, `UNKNOWN`, `UNDEFINED`) to `NULL`, split source URLs into `(site, external_id)` (host, then path plus query), and normalize titles (NFKC, lowercase) and studio keys. Hash each entry's canonical JSON, with keys sorted and every array sorted, since all dataset arrays are sets.
4. **Match identities** ([identity.ts](identity.ts)) inside one transaction, under an advisory lock.
5. **Guard rails** ([guards.ts](guards.ts)). Abort if there are fewer than 30,000 entries, the count moved more than 5% since the last successful run, more than 2% of active anime would be retired, or more than 1% would be merged.
6. **Stage** the desired state with `COPY` into the `catalog.staging_*` tables.
7. **Apply set-wise.** Write only real differences, so re-running a release changes nothing and keeps `updated_at`. Then record the counts in `catalog.import_runs` and commit.

If anything fails, the transaction rolls back and the run row is marked `failed` with the error.

Cache invalidation is deferred: there are no catalog pages yet.

## Identity rules

The dataset has no stable IDs, so an entry is the same anime as before when they share a source URL.

| Case                                        | Result                                                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| No URL known                                | New anime                                                                                                                   |
| URLs of one anime                           | Same id; updated only if the hash changed                                                                                   |
| URLs of several anime (**merge**)           | Keeps the lowest id. The others are retired with a redirect in `anime_redirects`, and older redirects follow the new target |
| Several entries share one anime (**split**) | The entry sharing the most URLs keeps the id (a tie goes to the smallest shared URL). The others become new anime           |
| An anime no entry matches                   | **Retired** (`retired_at`). Never deleted. Its URLs stay mapped, so it is **revived** with the same id if they come back    |

Child rows (titles, studios, tags, relations) of retired anime are kept as they were. Readers filter on `retired_at is null`.

## Data model rules

- **Sources:** `catalog.data_sources` lists the sources, with one active source per data type. Extra sources only fill gaps and never overwrite existing values.
- **Community overrides:** `catalog.overrides`, and `catalog.studio_aliases` rows with `source = 'override'`. Imports never write, update or delete these. An override alias moves a raw studio spelling to another studio, which fixes a false merge.
- **IDs:** anime use our own `bigint` IDs. External IDs live in `catalog.external_ids` as `(site, external_id)`, derived from the URLs. Never hardcode third-party site names in code, and never use external IDs as primary keys or in our URLs.
- **Studios:** one studio per normalized key (corporate suffixes such as `inc.` or `co., ltd.` are stripped). Every raw spelling is kept as an alias.
- **Score:** `catalog.anime_scores` orders the deck internally, and the public roles can't read it. The raw entry (including picture URLs, which must not be hotlinked) is in `catalog.anime_source_records`, which is also private.
- **Schema:** ODbL data lives in its own `catalog` schema, separate from user data.

## Searching titles

`catalog.anime_titles` has one row per title (the main title plus each synonym), with a `pg_trgm` GIN index on `search_text`. Normalize the query the same way (`searchText` in [normalize.ts](normalize.ts)) and filter with **`search_text %> $query`** (word similarity). The equivalent `$query <% search_text` is not turned into an index condition, so it scans the whole index.

## Tests

`pnpm test` runs the unit tests and [run.test.ts](run.test.ts), which applies the real migrations to an in-memory Postgres (PGlite). That covers first load, idempotency, merge, split, retire and revive, overrides, rollback, RLS and the trigram index.
