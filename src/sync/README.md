# Sync (placeholder)

The planned importer for the catalog. There is no code here yet, and building it is the next step for the catalog.

The only source is [anime-offline-database](https://github.com/cedya77/anime-offline-database), the cedya77 fork. See the [Data source](../../README.md#data-source) section of the main README for the license and attribution.

## Import run

1. **Download a pinned release.** Fetch `anime-offline-database.jsonl` from an explicit `<year>-<week>` release tag, never `latest`. Changing the tag is a deliberate code or config change.
2. **Validate.** Stream the file and check each line against the dataset's JSON schema (`schemas/anime-offline-database.jsonl.schema.json` in the dataset repo). The first line is a metadata line, not an anime. Any invalid line fails the run before anything is written.
3. **Load into staging.** Write the validated rows to a staging table.
4. **Diff by content hash.** Compare each row's hash with the stored one to find new, changed and removed entries.
5. **Apply in one transaction.** Either the whole release applies or none of it does.
6. **Log the run.** Record the source, release tag and counts in `import_runs`.
7. **Invalidate.** Revalidate the affected pages by cache tag.

## Data model rules

- **Sources:** a `data_sources` registry table lists the sources, with one active source per data type. Extra sources only fill gaps and never overwrite existing values.
- **Community overrides:** these live in their own table, and imports never overwrite them.
- **IDs:** anime use our own `bigint` IDs. External IDs live in a generic mapping table of `(site, external_id)`, derived from the dataset's `sources` URLs. Never hardcode third-party site names in code, and never use external IDs as primary keys or in our URLs.
- **Removals:** never hard-delete an anime. Retire it instead, and keep a redirect when entries merge.
- **Schema:** ODbL data lives in its own `catalog` schema, separate from user data.

## Access

- Writes use a secret key that bypasses RLS, so it must stay in server-side code. Add it to `src/env.ts` as a server variable when this is built.
- Application code never imports from `@/sync`. ESLint enforces this.
