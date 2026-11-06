import "server-only";

import { getCurrentUser } from "@/features/auth/queries";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type MyProfile = Tables<"profiles"> & { email: string | null };

/** The signed-in user's own profile, or null when signed out. */
export async function getMyProfile(): Promise<MyProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, created_at")
    .eq("id", user.id)
    .single();
  if (error) throw error;

  return { ...data, email: user.email };
}
