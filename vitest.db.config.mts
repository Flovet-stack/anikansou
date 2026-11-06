import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Database tests run against the Supabase project in .env.test.
// See .env.test.example.
if (existsSync(".env.test")) process.loadEnvFile(".env.test");

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Tests in a file share users, so they must run in order.
    sequence: { concurrent: false },
  },
});
