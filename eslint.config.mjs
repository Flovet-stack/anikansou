import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const noSyncImports = {
  group: ["@/sync", "@/sync/*"],
  message: "Application code must not depend on the sync module.",
};

const noSupabaseImports = {
  group: ["@/lib/supabase/*"],
  message:
    "Only features/*/queries.ts, queries.client.ts and actions.ts may use Supabase clients.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/sync/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [noSyncImports, noSupabaseImports] },
      ],
    },
  },
  {
    // The data-access layer: the only code allowed to use Supabase clients.
    files: [
      "src/proxy.ts",
      "src/lib/supabase/**/*.ts",
      "src/features/**/queries.ts",
      "src/features/**/queries.client.ts",
      "src/features/**/actions.ts",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [noSyncImports] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated output:
    "playwright-report/**",
    "test-results/**",
    "src/types/database.types.ts",
  ]),
]);

export default eslintConfig;
