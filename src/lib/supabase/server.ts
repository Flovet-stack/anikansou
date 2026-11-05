import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/env";
import type { Database } from "@/types/database.types";

/**
 * Per-request client that acts as the signed-in user. Use it in Server Actions,
 * Route Handlers and uncached Server Components.
 *
 * Never call it inside `use cache`: it reads cookies(), which is not allowed
 * there. Use createPublicClient from ./public for cached reads.
 *
 * Verify the user with auth.getClaims(). Never trust auth.getSession() on the server.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot write cookies. Actions and Route Handlers
            // can, and proxy.ts refreshes sessions on the routes that need it.
          }
        },
      },
    },
  );
}
