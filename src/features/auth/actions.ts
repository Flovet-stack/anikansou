"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { requestOrigin } from "./origin";
import { DEFAULT_NEXT, logInSchema, safeNext, signUpSchema } from "./schemas";

export type AuthFormState = {
  error: string | null;
  /** Echoed back so the field keeps its value after an error. */
  email: string;
};

const GENERIC_ERROR =
  "Something went wrong on our side. Try again in a moment.";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function nextFrom(formData: FormData): Promise<string> {
  return safeNext(field(formData, "next"), await requestOrigin());
}

function usernameStep(next: string): string {
  return next === DEFAULT_NEXT
    ? "/auth/username"
    : `/auth/username?next=${encodeURIComponent(next)}`;
}

export async function signUp(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email");
  const parsed = signUpSchema.safeParse({
    email,
    password: field(formData, "password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR, email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);

  if (error) {
    switch (error.code) {
      case "user_already_exists":
      case "email_exists":
        return {
          error: "An account with this email already exists. Log in instead.",
          email,
        };
      case "weak_password":
        return {
          error: "That password is too easy to guess. Try a longer one.",
          email,
        };
      case "email_address_invalid":
        return {
          error: "We can't use that email address. Try another one.",
          email,
        };
      default:
        return { error: GENERIC_ERROR, email };
    }
  }
  if (!data.session) {
    // Email confirmation is off by design (spec 02); without a session the
    // project's Auth settings don't match.
    return { error: GENERIC_ERROR, email };
  }

  redirect(usernameStep(await nextFrom(formData)));
}

export async function logIn(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email");
  const parsed = logInSchema.safeParse({
    email,
    password: field(formData, "password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // One message for unknown emails and wrong passwords alike.
    return {
      error: "Email or password is incorrect. Check them and try again.",
      email,
    };
  }

  // The proxy sends users without a username to the username step.
  redirect(await nextFrom(formData));
}

export async function continueWithGoogle(formData: FormData): Promise<void> {
  const origin = await requestOrigin();
  const next = safeNext(field(formData, "next"), origin);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) redirect("/auth/login?error=google");
  redirect(data.url);
}

export async function logOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
