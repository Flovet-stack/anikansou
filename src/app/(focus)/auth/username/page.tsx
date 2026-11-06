import { Suspense } from "react";

import { AuthShell, FormFallback } from "@/features/auth/components/auth-shell";
import { safePathOrNull } from "@/features/auth/schemas";
import { UsernameForm } from "@/features/profiles/components/username-form";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Choose a username",
  path: "/auth/username",
});

type SearchParams = PageProps<"/auth/username">["searchParams"];

// The proxy keeps signed-out users and users who already have a username away
// from this page; the action checks the user again.
export default function UsernamePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <AuthShell
      title="Choose a username"
      description="This is how other fans will find you."
      step={2}
    >
      <Suspense fallback={<FormFallback />}>
        <UsernameStep searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function UsernameStep({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;

  return (
    <UsernameForm
      next={safePathOrNull(typeof next === "string" ? next : null)}
    />
  );
}
