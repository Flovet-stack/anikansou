import { createClient } from "@/lib/supabase/browser";

/** For display only (the header link). Server code verifies users itself. */
export async function isSignedIn(): Promise<boolean> {
  const { data, error } = await createClient().auth.getClaims();
  return !error && Boolean(data?.claims.sub);
}

/** Calls `onChange` whenever the browser client sees a sign-in or sign-out. */
export function onAuthChange(onChange: () => void): () => void {
  const { data } = createClient().auth.onAuthStateChange(() => onChange());
  return () => data.subscription.unsubscribe();
}
