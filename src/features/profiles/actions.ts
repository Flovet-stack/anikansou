"use server";

import { redirect } from "next/navigation";

import { requestOrigin } from "@/features/auth/origin";
import { getCurrentUser } from "@/features/auth/queries";
import { safeNext } from "@/features/auth/schemas";
import { createClient } from "@/lib/supabase/server";

import { displayNameSchema, usernameSchema } from "./schemas";

const GENERIC_ERROR =
  "Something went wrong on our side. Try again in a moment.";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export type UsernameFormState = { error: string | null; username: string };

export async function setUsername(
  _previous: UsernameFormState,
  formData: FormData,
): Promise<UsernameFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=%2Fauth%2Fusername");

  const username = field(formData, "username");
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? GENERIC_ERROR,
      username,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ username: parsed.data })
    .eq("id", user.id)
    .is("username", null)
    .select("username");

  if (error) {
    if (error.code === "23505") {
      return { error: "That username is taken. Try another one.", username };
    }
    if (error.code === "23514") {
      return {
        error:
          "That username isn't available. Use 3–20 letters, numbers or underscores, starting with a letter.",
        username,
      };
    }
    return { error: GENERIC_ERROR, username };
  }
  // No row updated: the username was already set. The next page shows it.

  const next = safeNext(field(formData, "next"), await requestOrigin());
  redirect(data.length > 0 ? next : "/settings");
}

export type DisplayNameFormState = {
  error: string | null;
  saved: boolean;
  displayName: string;
};

export async function updateDisplayName(
  _previous: DisplayNameFormState,
  formData: FormData,
): Promise<DisplayNameFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=%2Fsettings");

  const displayName = field(formData, "display_name");
  const parsed = displayNameSchema.safeParse(displayName);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? GENERIC_ERROR,
      saved: false,
      displayName,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data })
    .eq("id", user.id);

  if (error) return { error: GENERIC_ERROR, saved: false, displayName };
  return { error: null, saved: true, displayName: parsed.data ?? "" };
}
