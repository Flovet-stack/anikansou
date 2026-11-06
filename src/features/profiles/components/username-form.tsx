"use client";

import { useActionState, useState } from "react";

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

  // Live preview of the stored (lowercase) name. Reset to what the server
  // returned whenever an attempt comes back, since React resets the form then.
  const [typed, setTyped] = useState(state.username);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    setTyped(state.username);
  }
  const preview = typed.trim().toLowerCase();

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Username</Label>
        <p id="username-hint" className="text-caption text-muted-foreground">
          {USERNAME_HINT} You can&apos;t change it later.
        </p>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-body text-text-subtle"
          >
            @
          </span>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={20}
            defaultValue={state.username}
            onChange={(event) => setTyped(event.target.value)}
            className="pl-9"
            aria-invalid={state.error ? true : undefined}
            aria-describedby={
              state.error ? "username-hint username-error" : "username-hint"
            }
          />
        </div>
        <p className="min-h-5 text-small text-muted-foreground" aria-live="off">
          {preview ? (
            <>
              Shown as{" "}
              <span className="font-semibold text-foreground">@{preview}</span>
            </>
          ) : null}
        </p>
      </div>

      <FormMessage id="username-error" error={state.error} />

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save username"}
      </Button>
    </form>
  );
}
