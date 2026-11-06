import { Suspense } from "react";

import { AuthForm } from "@/features/auth/components/auth-form";
import { AuthShell, FormFallback } from "@/features/auth/components/auth-shell";
import { safePathOrNull } from "@/features/auth/schemas";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Create an account",
  path: "/auth/sign-up",
});

type SearchParams = PageProps<"/auth/sign-up">["searchParams"];

export default function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <AuthShell
      title="Create an account"
      description="Rate, track and remember every anime you watch. It takes a minute."
      step={1}
    >
      <Suspense fallback={<FormFallback />}>
        <SignUpForm searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function SignUpForm({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;

  return (
    <AuthForm
      mode="sign-up"
      next={safePathOrNull(typeof next === "string" ? next : null)}
    />
  );
}
