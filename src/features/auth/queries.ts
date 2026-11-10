import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/** The signed-in user, verified with getClaims(). Never use getSession() on the server. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;

  const email = data.claims.email;
  return {
    id: data.claims.sub,
    email: typeof email === "string" ? email : null,
  };
}

const NEW_ACCOUNT_MS = 10 * 60 * 1000;

/**
 * Whether the signed-in account was created in the last few minutes, so going
 * back to an unfinished username step later isn't counted as another sign-up.
 */
export async function isNewAccount(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  return Date.now() - Date.parse(data.user.created_at) < NEW_ACCOUNT_MS;
}

/**
 * Finishes the OAuth PKCE flow for /auth/callback. Kept out of actions.ts on
 * purpose: a "use server" export would be callable from any client.
 */
export async function exchangeAuthCode(code: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return !error;
}
