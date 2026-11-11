import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/browser";

/** For display only (the header link). Server code verifies users itself. */
export async function isSignedIn(): Promise<boolean> {
  const { data, error } = await createClient().auth.getClaims();
  return !error && Boolean(data?.claims.sub);
}

export async function getAuthUser(): Promise<User | null> {
  const { data, error } = await createClient().auth.getUser();
  return error ? null : data.user;
}

/** Calls `onChange` whenever the browser client sees a sign-in or sign-out. */
export function onAuthChange(
  onChange: (user: User | null) => void,
): () => void {
  const { data } = createClient().auth.onAuthStateChange((_event, session) =>
    onChange(session?.user ?? null),
  );
  return () => data.subscription.unsubscribe();
}
