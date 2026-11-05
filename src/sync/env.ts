import { z } from "zod";

/**
 * Env for the importer, which runs under Node, outside the Next app, so it
 * validates its own variables instead of using `src/env.ts`.
 */
const schema = z.object({
  // Supabase session pooler URI (port 5432). Server-only; never NEXT_PUBLIC_.
  DATABASE_URL: z
    .string()
    .regex(
      /^postgres(ql)?:\/\//,
      "DATABASE_URL must be a postgres:// connection string",
    ),
});

export function readEnv(env: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(env);
  if (!result.success) {
    // Report which variable is wrong, never its value.
    const names = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Missing or invalid env: ${names}. Set DATABASE_URL in .env.local (local) or as a repo secret (CI).`,
    );
  }
  return result.data;
}
