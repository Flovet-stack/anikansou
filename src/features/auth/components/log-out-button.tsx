"use client";

import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import { env } from "@/env";

import { logOut } from "../actions";

export function LogOutButton() {
  const handleSubmit = () => {
    if (
      env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
      env.NEXT_PUBLIC_POSTHOG_HOST
    ) {
      posthog.reset();
    }
  };

  return (
    <form action={logOut} onSubmit={handleSubmit}>
      <Button type="submit" variant="secondary">
        Log out
      </Button>
    </form>
  );
}
