import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

const port = 3100;

// Auth tests sign up throwaway users in the Supabase project in .env.test.
// See .env.test.example.
if (existsSync(".env.test")) process.loadEnvFile(".env.test");

const supabaseUrl = process.env.TEST_SUPABASE_URL;
const supabaseKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "E2E tests need TEST_SUPABASE_URL and TEST_SUPABASE_PUBLISHABLE_KEY in .env.test (see .env.test.example).",
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // Auth steps make round trips to Supabase, which can take a few seconds.
  expect: { timeout: 15_000 },
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Tests run against a production build.
  webServer: {
    command: `pnpm build && pnpm exec next start -p ${port}`,
    url: `http://localhost:${port}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SITE_URL: "https://anikansou.test",
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseKey,
    },
  },
});
