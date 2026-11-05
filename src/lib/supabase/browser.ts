import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/env";
import type { Database } from "@/types/database.types";

/** For Client Components, such as per-user state on public pages. */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
