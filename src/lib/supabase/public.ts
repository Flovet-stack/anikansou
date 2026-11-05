import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/env";
import type { Database } from "@/types/database.types";

/**
 * Anonymous client with no cookies or session, safe inside `use cache`. Use it
 * for public catalog reads. It runs as the `anon` role, so RLS still applies.
 */
export function createPublicClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
