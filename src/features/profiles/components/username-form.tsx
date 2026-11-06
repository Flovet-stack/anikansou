"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type UsernameFormState, setUsername } from "../actions";
import { USERNAME_HINT } from "../schemas";

export function UsernameForm({ next }: { next: string | null }) {
  const [state, formAction, pending] = useActionState<
    UsernameFormState,
    FormData
  >(setUsername, { error: null, username: "" });

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={20}
          defaultValue={state.username}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={
            state.error ? "username-hint username-error" : "username-hint"
          }
        />
        <p id="username-hint" className="text-xs text-muted-foreground">
          {USERNAME_HINT} You can&apos;t change it later.
        </p>
      </div>

      <FormMessage id="username-error" error={state.error} />

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save username"}
      </Button>
    </form>
  );
}
