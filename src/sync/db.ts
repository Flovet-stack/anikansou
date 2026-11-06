import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { Sql, TransactionSql } from "postgres";

export type Param = string | number | boolean | null;
export type CopyValue =
  string | number | boolean | null | Record<string, unknown> | unknown[];

/**
 * The few database operations the importer needs. One implementation runs on
 * `postgres` (production), one on PGlite (tests), so the same SQL is tested.
 */
export interface Db {
  query<T = Record<string, unknown>>(
    text: string,
    params?: Param[],
  ): Promise<T[]>;
  /** Bulk-loads rows with COPY … FROM STDIN (text format). */
  copy(table: string, columns: string[], rows: CopyValue[][]): Promise<void>;
  /** Runs `fn` in one transaction; rolls back if it throws. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

function copyField(value: CopyValue): string {
  if (value === null) return "\\N";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

export function* copyText(
  rows: CopyValue[][],
  batch = 2000,
): Generator<string> {
  let chunk = "";
  let n = 0;
  for (const row of rows) {
    chunk += row.map(copyField).join("\t") + "\n";
    n += 1;
    if (n === batch) {
      yield chunk;
      chunk = "";
      n = 0;
    }
  }
  if (chunk) yield chunk;
}

const IDENT = /^[a-z_][a-z0-9_.]*$/;
function copySql(table: string, columns: string[], source: string) {
  for (const name of [table, ...columns]) {
    if (!IDENT.test(name))
      throw new Error(`Unsafe identifier in COPY: ${name}`);
  }
  return `copy ${table} (${columns.join(", ")}) from ${source}`;
}

type PgliteLike = PGlite | Transaction;

export function pgliteDb(pg: PgliteLike): Db {
  return {
    async query<T>(text: string, params: Param[] = []) {
      return (await pg.query<T>(text, params)).rows;
    },
    async copy(table, columns, rows) {
      const blob = new Blob([...copyText(rows)]);
      await pg.query(copySql(table, columns, "'/dev/blob'"), [], { blob });
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (!("transaction" in pg)) return fn(pgliteDb(pg));
      return pg.transaction((tx) => fn(pgliteDb(tx)));
    },
  };
}

export function postgresDb(sql: Sql | TransactionSql): Db {
  return {
    async query<T>(text: string, params: Param[] = []) {
      return (await sql.unsafe(text, params)) as unknown as T[];
    },
    async copy(table, columns, rows) {
      const stream = await sql
        .unsafe(copySql(table, columns, "stdin"))
        .writable();
      await pipeline(Readable.from(copyText(rows)), stream);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (!("begin" in sql)) return fn(postgresDb(sql));
      return (await sql.begin((tx) => fn(postgresDb(tx)))) as T;
    },
  };
}
