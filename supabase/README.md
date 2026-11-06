# Database guide

How AniKansou's Supabase database is set up, how it gets updated, and what to do when something goes wrong. Read this before changing the schema or touching the catalog import.

- **Project:** `anikansou`, ref `vxjbnuoroimxylluwojh`, region eu-west-1.
- **Specs:** [01: catalog import](../specs/01-catalog-import.md) and [02: accounts](../specs/02-accounts.md).
- **Importer code and design notes:** [src/sync/README.md](../src/sync/README.md).

## The big picture

The database has three areas, each in its own Postgres **schema** (think of a schema as a folder of tables):

| Schema    | What it holds                                                                                              | Who writes it                           |
| --------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `auth`    | Sign-in accounts (emails, passwords, Google logins). Managed by Supabase.                                  | Supabase Auth                           |
| `public`  | Our user data. Today: `profiles` (one per account, created on sign-up).                                    | The app, as the signed-in user, via RLS |
| `catalog` | The anime data, imported from [anime-offline-database](https://github.com/cedya77/anime-offline-database). | Only the importer                       |

They are separate on purpose. The anime data has its own licence (ODbL), so it must not mix with user data. It is also replaced from outside every week, while user data is never touched by the import.

## Seeing the data in the Supabase dashboard

The **Table Editor opens on the `public` schema**, so at first you only see `profiles`. To see the anime data:

1. Open **Table Editor**.
2. Use the **schema dropdown** at the top of the table list (it says `public`) and choose **`catalog`**.
3. You'll see 25 tables. The useful ones to browse are `anime`, `anime_titles`, `studios` and `import_runs`.

If `catalog` isn't in the dropdown, check **Settings > Data API > Exposed schemas** includes it. The REST API needs that too.

For anything bigger than browsing, use the **SQL Editor**; see [Useful queries](#useful-queries). The SQL Editor runs as the database owner, so it sees everything, including private tables.

## What's in `catalog`

**Public tables** (anyone can read, nobody but the importer can write):

| Table             | One row per                                                     | About (2026-44) |
| ----------------- | --------------------------------------------------------------- | --------------: |
| `anime`           | Anime. Our own `id`, never reused. Retired, never deleted.      |          38,337 |
| `anime_titles`    | Title or synonym of an anime, with `search_text` for search     |         262,487 |
| `external_ids`    | Source URL (MyAnimeList, AniList…), split into site + id        |         192,084 |
| `studios`         | Studio or producer, merged by a normalized name                 |           6,523 |
| `studio_aliases`  | Raw spelling of a studio name → its studio                      |           7,047 |
| `anime_studios`   | Anime × studio × role (`studio` or `producer`)                  |          97,020 |
| `tags`            | Tag or genre                                                    |           3,139 |
| `anime_tags`      | Anime × tag                                                     |         587,583 |
| `anime_relations` | "Related to" link between two anime (untyped, as published)     |         137,425 |
| `anime_redirects` | Old anime id → the id it was merged into                        |               0 |
| `data_sources`    | Data source, with its licence and the attribution text we owe   |               1 |
| `image_sources`   | Poster source (in-house, TMDB, AniList), its rank and on/off    |               3 |
| `anime_images`    | Poster image of an anime from one source (link or Storage path) |   added by hand |

`anime_images` only shows app users rows that are `active` and whose source is switched on. Readers use the view **`poster_candidates`** (usable posters, lowest `priority` first); the app turns Storage paths into URLs and falls back to the generated poster. These two tables are filled by hand, never by the import ([spec 03](../specs/03-poster-sources.md), decision 0008).

**Private tables** (no access for app users at all):

| Table                  | Why it's private                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `anime_scores`         | The dataset's score. It orders the swipe deck but is never shown to users (brief). |
| `anime_source_records` | Each entry exactly as published, including picture URLs we must not hotlink.       |
| `import_runs`          | Log of every import: release, counts, errors.                                      |
| `overrides`            | Community corrections. Not used by any page yet.                                   |
| `staging_*` (10)       | Scratch space for the importer. Emptied at the start and end of every run.         |

**Ids.** Our `anime.id` is permanent. External ids (MAL, AniList…) live only in `external_ids` and never appear in our URLs or as keys. If the dataset merges two anime, the lower id is kept and the other gets a row in `anime_redirects`, so links and (later) user data can follow it.

## Who can do what (RLS)

Every table has row-level security (RLS) on. The rules, as verified on the live database:

- **`anon` and `authenticated`** (the app's users, through the publishable key) can `SELECT` the 11 public catalog tables, and nothing else in `catalog`: no insert, update or delete anywhere, and no access to the private tables.
- **The importer** connects as `postgres` (the owner) through `DATABASE_URL`, so it can write.
- **`profiles`** follows spec 02: everyone can read profiles, and users can update only their own `username` and `display_name`.
- **Future tables.** In `catalog`, a new table gets **no** API access until a migration grants it. In `public`, Supabase grants full access to the API roles by default, so every new `public` table needs RLS and explicit grants in the same migration.

## How the catalog gets updated

```
Weekly (Mondays 06:17 UTC)                                    You
┌──────────────────────────────┐   PR: bump to 2026-45   ┌────────────┐
│ "Catalog release bump" action │ ──────────────────────▶ │ review +   │
│ finds a newer dataset release │                          │ merge PR   │
└──────────────────────────────┘                          └─────┬──────┘
                                                                │ push to main changes
                                                                ▼ src/sync/release.json
                                              ┌──────────────────────────────────┐
                                              │ "Catalog import" action          │
                                              │ download → check sha256 →        │
                                              │ validate → match → guard rails → │
                                              │ stage → apply in ONE transaction │
                                              └──────────────────────────────────┘
```

1. **The pin.** [src/sync/release.json](../src/sync/release.json) says exactly which release to load (tag + sha256 of the file). The importer never uses "latest".
2. **Weekly bump PR.** The _Catalog release bump_ workflow opens (or updates) one PR that changes only `release.json`. Nothing changes in the database until you merge it.
3. **Import on merge.** Merging runs the _Catalog import_ workflow, which applies only the differences.
4. **All or nothing.** The whole import is one transaction. If anything fails, the catalog stays exactly as it was and the run is logged as `failed`.
5. **Re-running is safe.** Importing the same release again changes nothing. Verified live: the second run of `2026-44` wrote zero catalog rows.

You can also run an import by hand: **Actions > Catalog import > Run workflow** (re-imports the pinned release), or locally with `pnpm sync:catalog` (needs `DATABASE_URL` in `.env.local`).

### What the importer does with changes

The dataset has no ids of its own, so an entry is matched to our anime by shared source URLs:

| What happened upstream             | What we do                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| New entry                          | New anime, new id                                                                  |
| Entry changed (title, episodes…)   | Same id, updated in place                                                          |
| Two entries became one (**merge**) | Keep the lower id, retire the other, add a redirect                                |
| One entry became two (**split**)   | The entry sharing the most URLs keeps the id; the other is new                     |
| Entry disappeared                  | **Retired** (`retired_at` set), never deleted                                      |
| A retired entry came back          | **Revived** with its old id                                                        |
| Two entries share a URL            | The URL gets one owner; an entry left with no URL of its own is skipped and logged |

Readers must filter `retired_at is null` to show only current anime.

### Guard rails

An import stops (and changes nothing) if the release looks wrong:

- fewer than 30,000 entries;
- the entry count moved more than 5% since the last successful run;
- more than 2% of anime would be retired;
- more than 1% would be merged.

If the change is real (for example, upstream deliberately removed a batch of entries), re-run by hand with **`allow_large_change`** ticked.

## Changing the schema

1. **Write a new migration** in `supabase/migrations/` named `<timestamp>_<name>.sql`. **Never edit a migration that has been applied**; add a new one that alters things instead.
2. In the same migration: enable RLS on every new table, add policies, and grant only what's needed (see [Who can do what](#who-can-do-what-rls)).
3. **Test it.** `pnpm test` applies every migration to an in-memory Postgres (PGlite), so a migration that doesn't apply fails the catalog tests. `pnpm test:db` runs the accounts RLS tests against Supabase.
4. **Apply it** to the Supabase project (`pnpm dlx supabase db push`, or the SQL Editor). Keep the file name's timestamp equal to the version Supabase records, so the two stay in sync.
5. **Regenerate the types** and commit them:

   ```bash
   npx supabase gen types typescript --project-id vxjbnuoroimxylluwojh --schema public --schema catalog > src/types/database.types.ts
   ```

   This needs a one-time `npx supabase login` in a terminal.

6. If you change catalog tables, check whether the importer (`src/sync/run.ts`) needs to write the new columns.

## When something goes wrong

Every import leaves a row in `catalog.import_runs`. Start there:

```sql
select id, release_tag, status, entry_count, inserted, updated, retired, merged, split,
       finished_at - started_at as took, error, details
from catalog.import_runs order by id desc limit 5;
```

| Symptom                                              | Cause                                                   | What to do                                                                                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run `failed`: "Guard rails stopped the import"       | The release changes more than the limits allow          | Read the numbers in `error`. Compare the release on GitHub. If it's real, run the import by hand with `allow_large_change`; if not, don't merge the next bump and wait for a fixed release. |
| "sha256 mismatch"                                    | Download cut off, or the release file was replaced      | Re-run. If it persists, the release changed after we pinned it: run **Catalog release bump** by hand, or update `release.json` with the new sha256 after checking the release.              |
| "Release file is invalid … line N"                   | The dataset's format changed                            | Look at line N of the file. Update `src/sync/schema.ts` to match the dataset's new JSON schema, with a test, in a PR.                                                                       |
| "Another catalog import is running"                  | Two imports overlapped                                  | Wait for the other one to finish, then re-run if needed.                                                                                                                                    |
| "password authentication failed"                     | Wrong or placeholder password in `DATABASE_URL`         | Use the **Session pooler** URI from Supabase > Connect, with the real password (URL-encode `@ # / ? :`). Update the `DATABASE_URL` repo secret too.                                         |
| Workflow times out (45 min)                          | Slow upload of staging data (~130 MB per run)           | Re-run. If it keeps happening, the fix is to skip staging unchanged raw entries (needs a new migration); see the PR #5 notes.                                                               |
| Import fine but a title, episode count etc. is wrong | The dataset is wrong                                    | Add a row to `catalog.overrides`. **Nothing reads overrides yet**: the catalog pages spec must apply them. Imports never overwrite them.                                                    |
| Two different studios shown as one (false merge)     | Their names normalize to the same key                   | Insert a studio with its own `key`, then set that spelling's `studio_aliases` row to `source = 'override'` and point it at the new studio. Imports keep override aliases.                   |
| An entry is missing after import                     | Its URLs all belong to another entry, so it was skipped | Check `details -> 'skippedLines'` in `import_runs` and look at those lines in the release.                                                                                                  |
| Anime links (later) point to a retired anime         | It was merged upstream                                  | Follow `catalog.anime_redirects`.                                                                                                                                                           |

**Undoing a bad import.** An import that finished cannot be rolled back by the importer. Options, from least to most drastic:

1. Fix forward: pin a good release in `release.json` and import it. Matching keeps ids stable, and retired anime come back with their ids.
2. Restore from a Supabase backup (**Database > Backups**). What's available depends on the plan; check it before you need it.

## Adding posters by hand

Sources, best first: `inhouse` (10), `tmdb` (20), `anilist` (30, **off** until AniList gives written permission). Use the SQL Editor.

```sql
-- A TMDB poster: paste the image link (it must start with https://image.tmdb.org/t/p/).
insert into catalog.anime_images (anime_id, source_id, url, external_ref)
values (123, (select id from catalog.image_sources where slug = 'tmdb'),
        'https://image.tmdb.org/t/p/w500/abc123.jpg', 'tv/209867');

-- An in-house poster: upload the file to the public Storage bucket `posters` first,
-- then record its path inside the bucket (no leading slash).
insert into catalog.anime_images (anime_id, source_id, storage_path)
values (123, (select id from catalog.image_sources where slug = 'inhouse'), 'frieren/poster.jpg');

-- A link stopped working: hide it, and the next source takes over.
update catalog.anime_images set status = 'broken' where id = 42;

-- Switch a whole source off (or on). Its posters disappear for everyone at once.
update catalog.image_sources set is_enabled = false where slug = 'tmdb';
```

The database refuses a link outside its source's prefix, a Storage path with `..` or a leading `/`, and a second poster from the same source for the same anime. A source's `url_prefix` can't be changed while it still has images, so old links never escape the check.

## Size and scaling

Measured after the first import (2026-44):

| What                              |   Size |
| --------------------------------- | -----: |
| Whole database                    | 267 MB |
| `catalog` schema                  | 255 MB |
| of which `anime_titles` + indexes |  75 MB |
| of which `anime_source_records`   |  53 MB |

- **Storage is the main limit.** Supabase's Free plan caps the database at 500 MB, so the catalog already uses about half. User data (ratings, lists, reviews) will add to this. Before launch, plan for a paid plan, or drop `anime_source_records` (53 MB) once the artwork decision is made.
- **Weekly growth is small.** A release adds a few hundred entries, and the import writes only differences.
- **Reads scale with indexes.** Title search uses the trigram index (35 ms on the full catalog). Filter with **`search_text %> $query`**, the form the index serves; `$query <% search_text` scans the whole index. Every foreign key and policy column is indexed.
- **Import time** is dominated by uploading staging data (about 130 MB). From a home connection it takes about 23 minutes; from GitHub's runners it should be much faster.

## Useful queries

```sql
-- Health check: counts and the last run.
select (select count(*) from catalog.anime where retired_at is null) as active_anime,
       (select count(*) from catalog.anime where retired_at is not null) as retired_anime,
       (select max(id) from catalog.import_runs) as last_run;

-- Find an anime by title (word similarity, uses the index).
select a.id, a.title, a.type, a.year, a.episodes
from catalog.anime_titles t join catalog.anime a on a.id = t.anime_id
where t.search_text %> 'frieren' and a.retired_at is null
group by a.id
order by max(extensions.word_similarity('frieren', t.search_text)) desc
limit 10;

-- Look an anime up by a source URL.
select a.* from catalog.external_ids e join catalog.anime a on a.id = e.anime_id
where e.site = 'myanimelist.net' and e.external_id = '/anime/52991';

-- What changed in the last import.
select id, title, updated_at, retired_at from catalog.anime
where last_changed_run_id = (select max(id) from catalog.import_runs where status = 'succeeded')
order by id limit 50;

-- Database size.
select pg_size_pretty(pg_database_size(current_database()));
```

## Settings this setup depends on

| Where                                               | Setting                                                    |
| --------------------------------------------------- | ---------------------------------------------------------- |
| Supabase > Settings > Data API > Exposed schemas    | includes `catalog`                                         |
| GitHub > Settings > Secrets and variables > Actions | `DATABASE_URL` = Session pooler URI (port 5432)            |
| GitHub > Settings > Actions > General               | "Allow GitHub Actions to create and approve pull requests" |
| `.env.local` (your machine, never committed)        | `DATABASE_URL` for local imports                           |

Use the session pooler: GitHub's runners need IPv4, and the direct database host is IPv6-only. Session mode also gives the importer one ordinary connection for its whole run, which is what it was built and tested against.
