"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  type AuthFormState,
  continueWithGoogle,
  logIn,
  signUp,
} from "../actions";

type Mode = "log-in" | "sign-up";

const copy = {
  "log-in": {
    submit: "Log in",
    pending: "Logging in…",
    switchText: "New to AniKansou?",
    switchLabel: "Create an account",
    switchHref: "/auth/sign-up",
    passwordAutocomplete: "current-password",
  },
  "sign-up": {
    submit: "Create account",
    pending: "Creating account…",
    switchText: "Already have an account?",
    switchLabel: "Log in",
    switchHref: "/auth/login",
    passwordAutocomplete: "new-password",
  },
} as const;

export function AuthForm({
  mode,
  next,
  initialError = null,
}: {
  mode: Mode;
  /** Already checked with safeNext on the server; checked again by the actions. */
  next: string | null;
  initialError?: string | null;
}) {
  const text = copy[mode];
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    mode === "log-in" ? logIn : signUp,
    { error: initialError, email: "" },
  );
  const switchHref = next
    ? `${text.switchHref}?${new URLSearchParams({ next }).toString()}`
    : text.switchHref;
  const errorId = `${mode}-error`;
  const hintId = `${mode}-password-hint`;

  return (
    <div className="flex flex-col gap-8">
      <form action={continueWithGoogle}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Button type="submit" variant="secondary" className="w-full">
          Continue with Google
        </Button>
      </form>

      <div className="flex items-center gap-3 text-caption text-text-subtle">
        <span className="h-px flex-1 bg-border" />
        or use email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="flex flex-col gap-5" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${mode}-email`}>Email</Label>
          <Input
            id={`${mode}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.email}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? errorId : undefined}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${mode}-password`}>Password</Label>
          <Input
            id={`${mode}-password`}
            name="password"
            type="password"
            autoComplete={text.passwordAutocomplete}
            required
            minLength={mode === "sign-up" ? 8 : undefined}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={
              [mode === "sign-up" ? hintId : null, state.error ? errorId : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
          />
          {mode === "sign-up" ? (
            <p id={hintId} className="text-caption text-muted-foreground">
              At least 8 characters.
            </p>
          ) : null}
        </div>

        <FormMessage id={errorId} error={state.error} />

        <Button type="submit" disabled={pending} className="mt-2">
          {pending ? text.pending : text.submit}
        </Button>
      </form>

      <p className="text-small text-muted-foreground">
        {text.switchText}{" "}
        <Link
          href={switchHref}
          className="font-semibold text-accent-text underline-offset-4 hover-fine:underline"
        >
          {text.switchLabel}
        </Link>
      </p>
    </div>
  );
}
