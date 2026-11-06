import { readFile, readdir } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

import { pgliteDb, type Db } from "../db.ts";

const MIGRATIONS = new URL("../../../supabase/migrations/", import.meta.url);

let template: Promise<Blob> | null = null;

/** Builds the migrated database once per test file, then reuses a dump of it. */
async function buildTemplate(): Promise<Blob> {
  const pg = await PGlite.create({ extensions: { pg_trgm } });
  // What Supabase provides on its own: the `extensions` schema and the API roles.
  await pg.exec(`
    create schema extensions;
    create role anon nologin;
    create role authenticated nologin;
    -- Minimal stand-ins for Supabase Auth, so migrations that reference it apply.
    create schema auth;
    create table auth.users (
      id uuid primary key,
      raw_user_meta_data jsonb not null default '{}'
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    alter database postgres set search_path = "$user", public, extensions;
  `);
  await pg.exec(`set search_path = "$user", public, extensions;`);
  const files = (await readdir(MIGRATIONS))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await pg.exec(await readFile(new URL(file, MIGRATIONS), "utf8"));
  }
  const dump = await pg.dumpDataDir("none");
  await pg.close();
  return dump;
}

/** An in-memory Postgres with the real migrations applied. */
export async function createTestDb(): Promise<{ db: Db; pg: PGlite }> {
  template ??= buildTemplate();
  const pg = await PGlite.create({
    extensions: { pg_trgm },
    loadDataDir: await template,
  });
  // Supabase puts `extensions` on the search path, which is where pg_trgm's operators live.
  await pg.exec(`set search_path = "$user", public, extensions;`);
  return { db: pgliteDb(pg), pg };
}
