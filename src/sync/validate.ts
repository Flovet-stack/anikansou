import {
  DATASET_REPOSITORY,
  entrySchema,
  metadataSchema,
  type Entry,
  type Metadata,
} from "./schema.ts";

export type ValidEntry = {
  /** 1-based line number in the release file. */
  line: number;
  /** The parsed JSON as published, used for the content hash and provenance. */
  raw: unknown;
  entry: Entry;
};

export type ValidationIssue = { line: number; message: string };

const MAX_REPORTED_ISSUES = 20;

export class ValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[], total: number) {
    const shown = issues
      .map((issue) => `  line ${issue.line}: ${issue.message}`)
      .join("\n");
    const more =
      total > issues.length ? `\n  …and ${total - issues.length} more` : "";
    super(`Release file is invalid (${total} problem(s)):\n${shown}${more}`);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

/**
 * Validates a whole release before anything is written. Line 1 must be the
 * metadata line for `tag`; every other non-empty line must be a valid entry.
 * Throws a ValidationError listing line numbers if anything is wrong.
 */
export async function validateLines(
  lines: Iterable<string> | AsyncIterable<string>,
  options: { tag: string },
): Promise<{ metadata: Metadata; entries: ValidEntry[] }> {
  const entries: ValidEntry[] = [];
  const issues: ValidationIssue[] = [];
  let total = 0;
  let metadata: Metadata | null = null;
  let lineNumber = 0;

  const report = (line: number, message: string) => {
    total += 1;
    if (issues.length < MAX_REPORTED_ISSUES) issues.push({ line, message });
  };

  for await (const text of lines) {
    lineNumber += 1;
    if (lineNumber > 1 && text.trim() === "") continue;

    const parsed = parseJson(text);
    if (!parsed.ok) {
      report(lineNumber, "not valid JSON");
      continue;
    }

    if (lineNumber === 1) {
      const result = metadataSchema.safeParse(parsed.value);
      if (!result.success) {
        report(1, `metadata line is malformed: ${result.error.message}`);
      } else if (!result.data.$schema.includes(`/${options.tag}/`)) {
        report(1, `metadata $schema is not for release ${options.tag}`);
      } else if (result.data.repository !== DATASET_REPOSITORY) {
        report(1, `metadata repository is not ${DATASET_REPOSITORY}`);
      } else {
        metadata = result.data;
      }
      continue;
    }

    const result = entrySchema.safeParse(parsed.value);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first?.path.join(".") || "(root)";
      report(lineNumber, `${path}: ${first?.message ?? "invalid"}`);
      continue;
    }
    entries.push({ line: lineNumber, raw: parsed.value, entry: result.data });
  }

  if (lineNumber === 0) throw new Error("Release file is empty");
  if (issues.length > 0) throw new ValidationError(issues, total);
  if (!metadata) throw new Error("Release file has no metadata line");
  return { metadata, entries };
}
