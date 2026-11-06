/**
 * Imports the pinned dataset release into the catalog schema.
 *
 *   pnpm sync:catalog [--dry-run] [--allow-large-change] [--file <path>] [--trigger manual|push|schedule]
 *
 * `--file` uses a local copy of the release instead of downloading it; its
 * sha256 must still match the pin.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import postgres from "postgres";

import { postgresDb } from "./db.ts";
import { download, readLines, verifyFile } from "./download.ts";
import { readEnv } from "./env.ts";
import { assetUrl, readPin } from "./release.ts";
import { runImport, type Trigger } from "./run.ts";

const TRIGGERS: Trigger[] = ["manual", "push", "schedule"];

async function main() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      "allow-large-change": { type: "boolean", default: false },
      file: { type: "string" },
      trigger: { type: "string", default: "manual" },
    },
  });
  const trigger = values.trigger as Trigger;
  if (!TRIGGERS.includes(trigger))
    throw new Error(`--trigger must be one of ${TRIGGERS.join(", ")}`);

  const { DATABASE_URL } = readEnv();
  const pin = await readPin();
  console.log(`Release ${pin.tag} (sha256 ${pin.sha256})`);

  const workDir = await mkdtemp(join(tmpdir(), "anikansou-catalog-"));
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    let path = values.file;
    if (!path) {
      path = join(workDir, "anime-offline-database.jsonl");
      console.log(`Downloading ${assetUrl(pin.tag)}`);
      await download(assetUrl(pin.tag), path);
    }
    await verifyFile(path, pin.sha256);
    console.log("sha256 verified");

    const result = await runImport({
      db: postgresDb(sql),
      pin,
      lines: readLines(path),
      trigger,
      gitCommit: process.env.GITHUB_SHA ?? null,
      dryRun: values["dry-run"],
      allowLargeChange: values["allow-large-change"],
    });
    console.log(
      JSON.stringify({ runId: result.runId, ...result.stats }, null, 2),
    );
  } finally {
    await sql.end({ timeout: 5 });
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
