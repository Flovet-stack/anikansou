import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Component tests opt in with a `// @vitest-environment jsdom` comment.
    environment: "node",
    // A component's first render loads Motion and jsdom; under a full
    // parallel run (and the pre-push hook) that alone can pass 5 s.
    testTimeout: 30_000,
    // One worker per file overloads an 8 GB machine: workers time out
    // starting up, which fails the run even when every test passes.
    maxWorkers: 4,
    include: ["src/**/*.test.{ts,tsx}"],
    // Database tests need Supabase: run them with `pnpm test:db`.
    exclude: ["src/**/*.db.test.ts"],
    env: {
      NEXT_PUBLIC_SITE_URL: "https://anikansou.test",
      NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_placeholder",
    },
  },
});
