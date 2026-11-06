import { Suspense } from "react";

import { AuthForm } from "@/features/auth/components/auth-form";
import { AuthShell, FormFallback } from "@/features/auth/components/auth-shell";
import { safePathOrNull } from "@/features/auth/schemas";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({ title: "Log in", path: "/auth/login" });

const ERRORS: Record<string, string> = {
  google:
    "Google sign-in didn't finish. Try again, or use your email and password.",
};

type SearchParams = PageProps<"/auth/login">["searchParams"];

export default function LogInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <AuthShell
      title="Log in"
      description="Welcome back. Your ratings are where you left them."
    >
      <Suspense fallback={<FormFallback />}>
        <LogInForm searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LogInForm({ searchParams }: { searchParams: SearchParams }) {
  const { next, error } = await searchParams;
  const errorKey = typeof error === "string" ? error : null;

  return (
    <AuthForm
      mode="log-in"
      next={safePathOrNull(typeof next === "string" ? next : null)}
      initialError={errorKey ? (ERRORS[errorKey] ?? null) : null}
    />
  );
}
