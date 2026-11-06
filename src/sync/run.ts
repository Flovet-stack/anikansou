import type { CopyValue, Db, Param } from "./db.ts";
import { checkGuards, type GuardOptions } from "./guards.ts";
import { contentHash } from "./hash.ts";
import { matchIdentities, type ExistingState } from "./identity.ts";
import {
  normalizeEntry,
  studioKey,
  type NormalizedAnime,
} from "./normalize.ts";
import type { Pin } from "./release.ts";
import { validateLines } from "./validate.ts";

export const DATA_SOURCE_SLUG = "anime-offline-database";
const LOCK_KEY = "anikansou:catalog-import";

export type Trigger = "schedule" | "push" | "manual";

export type RunOptions = {
  db: Db;
  pin: Pin;
  /** The release file, line by line. Its sha256 is checked before this is called. */
  lines: Iterable<string> | AsyncIterable<string>;
  trigger: Trigger;
  gitCommit?: string | null;
  dryRun?: boolean;
  allowLargeChange?: boolean;
  guards?: Partial<GuardOptions>;
  log?: (message: string) => void;
};

export type RunStats = {
  entries: number;
  inserted: number;
  updated: number;
  unchanged: number;
  retired: number;
  revived: number;
  merged: number;
  split: number;
  unresolvedRelations: number;
};

export type RunResult = {
  runId: number | null;
  stats: RunStats;
  details: Record<string, unknown>;
};

export class GuardError extends Error {
  constructor(problems: string[]) {
    super(
      `Guard rails stopped the import:\n${problems.map((p) => `  - ${p}`).join("\n")}\nRe-run with --allow-large-change if this is expected.`,
    );
    this.name = "GuardError";
  }
}

const num = (value: unknown) => Number(value);

type Prepared = {
  normalized: NormalizedAnime;
  hash: string;
  raw: unknown;
};

function timer(log: (m: string) => void) {
  let last = Date.now();
  return (phase: string) => {
    const now = Date.now();
    log(`${phase} (${((now - last) / 1000).toFixed(1)}s)`);
    last = now;
  };
}

/**
 * Imports one pinned release: validate → match identities → guard rails →
 * stage with COPY → apply set-wise in one transaction → log the run.
 * Any failure rolls the transaction back and marks the run `failed`.
 */
export async function runImport(options: RunOptions): Promise<RunResult> {
  const { db, pin } = options;
  const log = options.log ?? ((m: string) => console.log(m));
  const step = timer(log);

  const [source] = await db.query<{ id: number }>(
    "select id from catalog.data_sources where slug = $1 and is_active",
    [DATA_SOURCE_SLUG],
  );
  if (!source) throw new Error(`No active data source '${DATA_SOURCE_SLUG}'`);

  let runId: number | null = null;
  if (!options.dryRun) {
    const [run] = await db.query<{ id: number }>(
      `insert into catalog.import_runs (data_source_id, release_tag, sha256, trigger, git_commit)
       values ($1, $2, $3, $4, $5) returning id`,
      [
        num(source.id),
        pin.tag,
        pin.sha256,
        options.trigger,
        options.gitCommit ?? null,
      ],
    );
    runId = num(run?.id);
    log(`Run ${runId}: release ${pin.tag}`);
  }

  try {
    const { entries } = await validateLines(options.lines, { tag: pin.tag });
    step(`Validated ${entries.length} entries`);

    const prepared: Prepared[] = entries.map((e) => ({
      normalized: normalizeEntry(e.entry),
      hash: contentHash(e.raw),
      raw: e.raw,
    }));
    step("Normalized and hashed");

    const work = async (tx: Db) => {
      if (!options.dryRun) {
        const [lock] = await tx.query<{ locked: boolean }>(
          "select pg_try_advisory_xact_lock(hashtext($1)) as locked",
          [LOCK_KEY],
        );
        if (!lock?.locked) throw new Error("Another catalog import is running");
        await tx.query("set local statement_timeout = '30min'");
      }
      return applyRelease(tx, prepared, { ...options, runId, log, step });
    };

    const result = options.dryRun ? await work(db) : await db.transaction(work);
    step(options.dryRun ? "Dry run: nothing written" : "Committed");
    return { runId, ...result };
  } catch (error) {
    if (runId !== null) {
      const message = error instanceof Error ? error.message : String(error);
      await db.query(
        "update catalog.import_runs set status = 'failed', finished_at = now(), error = $2 where id = $1",
        [runId, message.slice(0, 10_000)],
      );
    }
    throw error;
  }
}

type ApplyContext = RunOptions & {
  runId: number | null;
  log: (m: string) => void;
  step: (phase: string) => void;
};

async function loadExisting(db: Db) {
  const anime = await db.query<{
    id: number;
    retired: boolean;
    content_hash: string;
  }>(
    "select id, retired_at is not null as retired, content_hash from catalog.anime",
  );
  const mappings = await db.query<{
    site: string;
    external_id: string;
    anime_id: number;
  }>("select site, external_id, anime_id from catalog.external_ids");
  const [previous] = await db.query<{ entry_count: number }>(
    `select entry_count from catalog.import_runs
     where status = 'succeeded' and entry_count is not null
     order by id desc limit 1`,
  );
  const overrideAliases = await db.query<{ raw_name: string }>(
    "select raw_name from catalog.studio_aliases where source = 'override'",
  );

  const state: ExistingState = {
    urlToId: new Map(
      mappings.map((m) => [`${m.site}${m.external_id}`, num(m.anime_id)]),
    ),
    anime: new Map(
      anime.map((a) => [num(a.id), { retired: Boolean(a.retired) }]),
    ),
  };
  return {
    state,
    hashes: new Map(anime.map((a) => [num(a.id), a.content_hash])),
    previousEntryCount: previous ? num(previous.entry_count) : null,
    overrideAliases: new Set(overrideAliases.map((a) => a.raw_name)),
  };
}

/** Most common spelling of a studio, then the shortest, then alphabetical. */
function displayNames(prepared: Prepared[], skip: Set<string>) {
  const counts = new Map<string, Map<string, number>>();
  for (const p of prepared) {
    for (const s of p.normalized.studios) {
      if (skip.has(s.raw)) continue;
      const key = studioKey(s.raw);
      const byName = counts.get(key) ?? new Map<string, number>();
      byName.set(s.raw, (byName.get(s.raw) ?? 0) + 1);
      counts.set(key, byName);
    }
  }
  const names = new Map<string, string>();
  for (const [key, byName] of counts) {
    const best = [...byName].sort(
      ([a, ca], [b, cb]) => cb - ca || a.length - b.length || (a < b ? -1 : 1),
    )[0];
    if (best) names.set(key, best[0]);
  }
  return names;
}

async function applyRelease(
  db: Db,
  prepared: Prepared[],
  ctx: ApplyContext,
): Promise<{ stats: RunStats; details: Record<string, unknown> }> {
  const existing = await loadExisting(db);
  ctx.step(
    `Loaded ${existing.state.anime.size} anime and ${existing.state.urlToId.size} external ids`,
  );

  const plan = matchIdentities(
    prepared.map((p) => ({ urls: p.normalized.urls.map((u) => u.key) })),
    existing.state,
  );

  const revivedSet = new Set(plan.revived);
  let updated = 0;
  plan.assignments.forEach((id, i) => {
    if (id === null || revivedSet.has(id)) return;
    if (existing.hashes.get(id) !== prepared[i]?.hash) updated += 1;
  });

  const stats: RunStats = {
    entries: prepared.length,
    inserted: plan.stats.new,
    updated,
    unchanged: plan.stats.matched - updated - plan.stats.revived,
    retired: plan.stats.retired,
    revived: plan.stats.revived,
    merged: plan.stats.merged,
    split: plan.stats.split,
    unresolvedRelations: 0,
  };
  const activeBefore = [...existing.state.anime.values()].filter(
    (a) => !a.retired,
  ).length;
  ctx.step(
    `Planned: ${stats.inserted} new, ${stats.updated} changed, ${stats.unchanged} unchanged, ` +
      `${stats.retired} retired, ${stats.revived} revived, ${stats.merged} merged, ${stats.split} split`,
  );

  const problems = checkGuards(
    {
      entryCount: prepared.length,
      previousEntryCount: existing.previousEntryCount,
      activeBefore,
      retired: plan.stats.retired,
      merged: plan.stats.merged,
    },
    ctx.guards,
  );
  if (problems.length > 0) {
    if (!ctx.allowLargeChange) throw new GuardError(problems);
    ctx.log(`Guard rails overridden:\n  - ${problems.join("\n  - ")}`);
  }

  if (ctx.dryRun || ctx.runId === null)
    return { stats, details: { guardProblems: problems } };
  const runId = ctx.runId;

  // Reserve ids for new anime from the table's identity sequence.
  const newIds = await db.query<{ id: number }>(
    "select nextval(pg_get_serial_sequence('catalog.anime', 'id')) as id from generate_series(1, $1)",
    [stats.inserted],
  );
  const ids: number[] = [];
  let next = 0;
  for (const assigned of plan.assignments) {
    ids.push(assigned ?? num(newIds[next++]?.id));
  }

  const { sharedUrls } = await stage(
    db,
    prepared,
    ids,
    plan,
    existing.overrideAliases,
    existing.state.urlToId,
  );
  ctx.step("Staged");
  if (sharedUrls > 0) {
    ctx.log(
      `${sharedUrls} source URL(s) appear in more than one entry; each kept one owner`,
    );
  }

  stats.unresolvedRelations = await apply(db, runId);
  ctx.step("Applied");

  const [overridesOnRetired] = await db.query<{ n: number }>(
    `select count(*) as n from catalog.overrides o
     join catalog.anime a on a.id = o.anime_id where a.retired_at is not null`,
  );
  const details = {
    guardProblems: problems,
    overridesOnRetiredAnime: num(overridesOnRetired?.n ?? 0),
    sharedUrls,
  };
  if (details.overridesOnRetiredAnime > 0) {
    ctx.log(
      `${details.overridesOnRetiredAnime} override(s) point at retired or merged anime`,
    );
  }

  await truncateStaging(db);
  await db.query(
    `update catalog.import_runs set
       status = 'succeeded', finished_at = now(), entry_count = $2, inserted = $3, updated = $4,
       unchanged = $5, retired = $6, revived = $7, merged = $8, split = $9,
       unresolved_relations = $10, details = $11::jsonb
     where id = $1`,
    [
      runId,
      stats.entries,
      stats.inserted,
      stats.updated,
      stats.unchanged,
      stats.retired,
      stats.revived,
      stats.merged,
      stats.split,
      stats.unresolvedRelations,
      JSON.stringify(details),
    ],
  );
  return { stats, details };
}

const STAGING = [
  "staging_anime",
  "staging_external_ids",
  "staging_titles",
  "staging_studios",
  "staging_studio_aliases",
  "staging_anime_studios",
  "staging_anime_tags",
  "staging_relations",
  "staging_merges",
  "staging_retired",
].map((t) => `catalog.${t}`);

async function truncateStaging(db: Db) {
  await db.query(`truncate ${STAGING.join(", ")}`);
}

async function stage(
  db: Db,
  prepared: Prepared[],
  ids: number[],
  plan: ReturnType<typeof matchIdentities>,
  overrideAliases: Set<string>,
  urlToId: Map<string, number>,
): Promise<{ sharedUrls: number }> {
  await truncateStaging(db);

  // A URL can appear in two entries of one release (mid-move upstream, or two
  // spellings that normalize to one key). external_ids holds one owner per URL:
  // the entry that kept the anime the URL already maps to, else the first entry.
  const owner = new Map<string, number>();
  let sharedUrls = 0;
  prepared.forEach((p, i) => {
    for (const u of p.normalized.urls) {
      const current = owner.get(u.key);
      if (current === undefined) {
        owner.set(u.key, i);
        continue;
      }
      if (current === i) continue;
      sharedUrls += 1;
      const mapped = urlToId.get(u.key);
      if (
        mapped !== undefined &&
        ids[i] === mapped &&
        ids[current] !== mapped
      ) {
        owner.set(u.key, i);
      }
    }
  });

  const anime: CopyValue[][] = [];
  const externalIds: CopyValue[][] = [];
  const titles: CopyValue[][] = [];
  const animeStudios: CopyValue[][] = [];
  const animeTags: CopyValue[][] = [];
  const relations: CopyValue[][] = [];
  const aliases = new Map<string, string>();

  prepared.forEach((p, i) => {
    const id = ids[i] as number;
    const n = p.normalized;
    anime.push([
      id,
      n.title,
      n.type,
      n.episodes,
      n.status,
      n.season,
      n.year,
      n.durationSeconds,
      p.hash,
      p.raw as Record<string, unknown>,
      n.score?.agm ?? null,
      n.score?.mean ?? null,
      n.score?.median ?? null,
    ]);
    for (const u of n.urls) {
      if (owner.get(u.key) === i)
        externalIds.push([id, u.site, u.externalId, u.url]);
    }
    for (const t of n.titles) titles.push([id, t.title, t.kind, t.searchText]);
    for (const s of n.studios) {
      animeStudios.push([id, s.raw, s.role]);
      if (!overrideAliases.has(s.raw)) aliases.set(s.raw, studioKey(s.raw));
    }
    for (const tag of n.tags) animeTags.push([id, tag]);
    for (const r of n.related) relations.push([id, r.site, r.externalId]);
  });

  const studios = [...displayNames(prepared, overrideAliases)].map(
    ([key, name]) => [key, name],
  );

  await db.copy(
    "catalog.staging_anime",
    [
      "anime_id",
      "title",
      "type",
      "episodes",
      "status",
      "season",
      "year",
      "duration_seconds",
      "content_hash",
      "payload",
      "score_agm",
      "score_mean",
      "score_median",
    ],
    anime,
  );
  await db.copy(
    "catalog.staging_external_ids",
    ["anime_id", "site", "external_id", "url"],
    externalIds,
  );
  await db.copy(
    "catalog.staging_titles",
    ["anime_id", "title", "kind", "search_text"],
    titles,
  );
  await db.copy("catalog.staging_studios", ["key", "name"], studios);
  await db.copy(
    "catalog.staging_studio_aliases",
    ["raw_name", "key"],
    [...aliases],
  );
  await db.copy(
    "catalog.staging_anime_studios",
    ["anime_id", "raw_name", "role"],
    animeStudios,
  );
  await db.copy("catalog.staging_anime_tags", ["anime_id", "tag"], animeTags);
  await db.copy(
    "catalog.staging_relations",
    ["anime_id", "site", "external_id"],
    relations,
  );
  await db.copy(
    "catalog.staging_merges",
    ["from_anime_id", "to_anime_id"],
    plan.merges.map((m) => [m.from, m.to]),
  );
  await db.copy(
    "catalog.staging_retired",
    ["anime_id"],
    plan.retired.map((id) => [id]),
  );

  for (const table of STAGING) await db.query(`analyze ${table}`);
  return { sharedUrls };
}

/**
 * Set-based apply from staging. Only real differences are written, so a run
 * of an unchanged release writes nothing. Child rows of anime that are not in
 * this release (retired or merged) are kept as they were.
 */
async function apply(db: Db, runId: number): Promise<number> {
  const run: Param[] = [runId];

  // Anime: new rows, changed or revived rows, then retirements and merges.
  await db.query(
    `insert into catalog.anime
       (id, title, type, episodes, status, season, year, duration_seconds, content_hash,
        first_seen_run_id, last_changed_run_id)
     select s.anime_id, s.title, s.type, s.episodes, s.status, s.season, s.year, s.duration_seconds,
            s.content_hash, $1, $1
     from catalog.staging_anime s
     where not exists (select 1 from catalog.anime a where a.id = s.anime_id)`,
    run,
  );
  await db.query(
    `update catalog.anime a set
       title = s.title, type = s.type, episodes = s.episodes, status = s.status, season = s.season,
       year = s.year, duration_seconds = s.duration_seconds, content_hash = s.content_hash,
       retired_at = null, updated_at = now(), last_changed_run_id = $1
     from catalog.staging_anime s
     where a.id = s.anime_id and (a.content_hash <> s.content_hash or a.retired_at is not null)`,
    run,
  );
  await db.query(
    `update catalog.anime set retired_at = now(), updated_at = now(), last_changed_run_id = $1
     where retired_at is null and id in (
       select anime_id from catalog.staging_retired
       union select from_anime_id from catalog.staging_merges)`,
    run,
  );

  // Redirects: add merges, point older redirects at the new target, drop any for revived anime.
  await db.query(
    `insert into catalog.anime_redirects (from_anime_id, to_anime_id, reason, created_run_id)
     select from_anime_id, to_anime_id, 'merged', $1 from catalog.staging_merges
     on conflict (from_anime_id) do update set to_anime_id = excluded.to_anime_id
     where catalog.anime_redirects.to_anime_id <> excluded.to_anime_id`,
    run,
  );
  await db.query(
    `update catalog.anime_redirects r set to_anime_id = m.to_anime_id
     from catalog.staging_merges m where r.to_anime_id = m.from_anime_id`,
  );
  await db.query(
    `delete from catalog.anime_redirects r
     using catalog.staging_anime s where r.from_anime_id = s.anime_id`,
  );

  // External ids: release URLs map to their anime; stale URLs of active anime go.
  // URLs of retired anime stay, so the anime can be revived if they return.
  await db.query(
    `insert into catalog.external_ids (site, external_id, anime_id, url)
     select site, external_id, anime_id, url from catalog.staging_external_ids
     on conflict (site, external_id) do update set anime_id = excluded.anime_id, url = excluded.url
     where (catalog.external_ids.anime_id, catalog.external_ids.url)
       is distinct from (excluded.anime_id, excluded.url)`,
  );
  await db.query(
    `delete from catalog.external_ids e
     using catalog.staging_anime s
     where e.anime_id = s.anime_id
       and not exists (select 1 from catalog.staging_external_ids x
                       where x.site = e.site and x.external_id = e.external_id)`,
  );

  // Titles.
  await db.query(
    `delete from catalog.anime_titles t
     using catalog.staging_anime s
     where t.anime_id = s.anime_id
       and not exists (select 1 from catalog.staging_titles x
                       where x.anime_id = t.anime_id and x.search_text = t.search_text
                         and x.title = t.title and x.kind = t.kind)`,
  );
  await db.query(
    `insert into catalog.anime_titles (anime_id, title, kind, search_text)
     select x.anime_id, x.title, x.kind, x.search_text from catalog.staging_titles x
     where not exists (select 1 from catalog.anime_titles t
                       where t.anime_id = x.anime_id and t.search_text = x.search_text)`,
  );

  // Studios and aliases. Override aliases are never touched.
  await db.query(
    `insert into catalog.studios (key, name) select key, name from catalog.staging_studios
     on conflict (key) do update set name = excluded.name
     where catalog.studios.name <> excluded.name`,
  );
  await db.query(
    `insert into catalog.studio_aliases (raw_name, studio_id, source)
     select a.raw_name, s.id, 'import' from catalog.staging_studio_aliases a
     join catalog.studios s on s.key = a.key
     on conflict (raw_name) do update set studio_id = excluded.studio_id
     where catalog.studio_aliases.source = 'import'
       and catalog.studio_aliases.studio_id <> excluded.studio_id`,
  );
  await db.query(
    `delete from catalog.studio_aliases a
     where a.source = 'import'
       and not exists (select 1 from catalog.staging_studio_aliases x where x.raw_name = a.raw_name)
       and not exists (select 1 from catalog.staging_anime_studios x where x.raw_name = a.raw_name)`,
  );
  const desiredStudios = `
    select distinct x.anime_id, a.studio_id, x.role
    from catalog.staging_anime_studios x
    join catalog.studio_aliases a on a.raw_name = x.raw_name`;
  // Deletes use NOT EXISTS anti-joins: `(…) NOT IN (subquery)` only hashes when
  // the subquery fits in work_mem, and otherwise rescans it for every row.
  await db.query(
    `delete from catalog.anime_studios t
     using catalog.staging_anime s
     where t.anime_id = s.anime_id
       and not exists (select 1 from catalog.staging_anime_studios x
                       join catalog.studio_aliases a on a.raw_name = x.raw_name
                       where x.anime_id = t.anime_id and a.studio_id = t.studio_id
                         and x.role = t.role)`,
  );
  await db.query(
    `insert into catalog.anime_studios (anime_id, studio_id, role)
     select * from (${desiredStudios}) d
     on conflict do nothing`,
  );

  // Tags.
  await db.query(
    `insert into catalog.tags (name) select distinct tag from catalog.staging_anime_tags
     on conflict (name) do nothing`,
  );
  const desiredTags = `
    select distinct x.anime_id, t.id as tag_id
    from catalog.staging_anime_tags x join catalog.tags t on t.name = x.tag`;
  await db.query(
    `delete from catalog.anime_tags t
     using catalog.staging_anime s
     where t.anime_id = s.anime_id
       and not exists (select 1 from catalog.staging_anime_tags x
                       join catalog.tags g on g.name = x.tag
                       where x.anime_id = t.anime_id and g.id = t.tag_id)`,
  );
  await db.query(
    `insert into catalog.anime_tags (anime_id, tag_id)
     select * from (${desiredTags}) d on conflict do nothing`,
  );

  // Relations, resolved through the external ids written above.
  const desiredRelations = `
    select distinct r.anime_id, e.anime_id as related_anime_id
    from catalog.staging_relations r
    join catalog.external_ids e on e.site = r.site and e.external_id = r.external_id
    where e.anime_id <> r.anime_id`;
  await db.query(
    `delete from catalog.anime_relations t
     using catalog.staging_anime s
     where t.anime_id = s.anime_id
       and not exists (select 1 from catalog.staging_relations r
                       join catalog.external_ids e
                         on e.site = r.site and e.external_id = r.external_id
                       where r.anime_id = t.anime_id and e.anime_id = t.related_anime_id)`,
  );
  await db.query(
    `insert into catalog.anime_relations (anime_id, related_anime_id)
     select * from (${desiredRelations}) d on conflict do nothing`,
  );
  const [unresolved] = await db.query<{ n: number }>(
    `select count(*) as n from catalog.staging_relations r
     where not exists (select 1 from catalog.external_ids e
                       where e.site = r.site and e.external_id = r.external_id)`,
  );

  // Scores (service-only).
  await db.query(
    `insert into catalog.anime_scores (anime_id, arithmetic_geometric_mean, arithmetic_mean, median)
     select anime_id, score_agm, score_mean, score_median from catalog.staging_anime
     where score_agm is not null
     on conflict (anime_id) do update set
       arithmetic_geometric_mean = excluded.arithmetic_geometric_mean,
       arithmetic_mean = excluded.arithmetic_mean, median = excluded.median
     where (catalog.anime_scores.arithmetic_geometric_mean, catalog.anime_scores.arithmetic_mean,
            catalog.anime_scores.median)
       is distinct from (excluded.arithmetic_geometric_mean, excluded.arithmetic_mean, excluded.median)`,
  );
  await db.query(
    `delete from catalog.anime_scores c using catalog.staging_anime s
     where c.anime_id = s.anime_id and s.score_agm is null`,
  );

  // Raw entries (service-only).
  await db.query(
    `insert into catalog.anime_source_records (anime_id, payload, content_hash)
     select anime_id, payload, content_hash from catalog.staging_anime
     on conflict (anime_id) do update set payload = excluded.payload, content_hash = excluded.content_hash
     where catalog.anime_source_records.content_hash <> excluded.content_hash`,
  );

  return num(unresolved?.n ?? 0);
}
