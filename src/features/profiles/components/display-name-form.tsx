"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type DisplayNameFormState, updateDisplayName } from "../actions";
import { DISPLAY_NAME_MAX } from "../schemas";

export function DisplayNameForm({
  displayName,
  username,
}: {
  displayName: string | null;
  username: string;
}) {
  const [state, formAction, pending] = useActionState<
    DisplayNameFormState,
    FormData
  >(updateDisplayName, {
    error: null,
    saved: false,
    displayName: displayName ?? "",
  });

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          // Remount after a save so the field shows the stored (trimmed) value.
          key={state.saved ? `saved-${state.displayName}` : "editing"}
          id="display-name"
          name="display_name"
          autoComplete="nickname"
          defaultValue={state.displayName}
          placeholder={username}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={
            state.error
              ? "display-name-hint display-name-message"
              : "display-name-hint"
          }
        />
        <p
          id="display-name-hint"
          className="text-caption text-muted-foreground"
        >
          Optional, up to {DISPLAY_NAME_MAX} characters. Leave it empty to show
          your username.
        </p>
      </div>

      <FormMessage
        id="display-name-message"
        error={state.error}
        success={state.saved ? "Saved." : null}
      />

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
