import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { LogOutButton } from "@/features/auth/components/log-out-button";
import { DisplayNameForm } from "@/features/profiles/components/display-name-form";
import { getMyProfile } from "@/features/profiles/queries";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({ title: "Settings", path: "/settings" });

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Settings
      </h1>
      <Suspense fallback={<div className="h-80" aria-hidden />}>
        <AccountSettings />
      </Suspense>
    </div>
  );
}

async function AccountSettings() {
  // The proxy already redirects these cases with a real HTTP redirect. This is
  // the second check, so the page never renders for the wrong user.
  // Account data is per request: keep it out of the prefetched App Shell, where
  // Supabase's session check (it reads the clock) isn't allowed.
  await connection();
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login?next=%2Fsettings");
  if (!profile.username) redirect("/auth/username?next=%2Fsettings");

  return (
    <>
      <section
        aria-labelledby="account-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="account-heading" className="text-lg font-semibold">
          Account
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Username</dt>
          <dd className="font-medium break-all">{profile.username}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="break-all">{profile.email ?? "—"}</dd>
        </dl>
      </section>

      <section
        aria-labelledby="profile-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="profile-heading" className="text-lg font-semibold">
          Profile
        </h2>
        <DisplayNameForm
          displayName={profile.display_name}
          username={profile.username}
        />
      </section>

      <section className="border-t pt-6">
        <LogOutButton />
      </section>
    </>
  );
}
