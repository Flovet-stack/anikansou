import { redirect } from "next/navigation";
import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";

import { DataAttribution } from "@/components/layout/data-attribution";
import { LogOutButton } from "@/features/auth/components/log-out-button";
import { DisplayNameForm } from "@/features/profiles/components/display-name-form";
import { getMyProfile } from "@/features/profiles/queries";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({ title: "Settings", path: "/settings" });

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-reading flex-col gap-12 md:gap-16">
      <h1 className="font-display text-title-l font-extrabold tracking-tight md:text-display-s">
        Settings
      </h1>
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <AccountSettings />
      </Suspense>
      {/* Below 1024 px the dataset credit lives here (from 1024: sidebar footer). */}
      <DataAttribution className="lg:hidden" />
    </div>
  );
}

function Panel({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-6 rounded-lg bg-surface-1 p-6 md:p-8"
    >
      <h2 id={id} className="font-display text-title-s font-bold">
        {title}
      </h2>
      {children}
    </section>
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
    <div className="flex flex-col gap-12 md:gap-16">
      <Panel id="account-heading" title="Account">
        <dl className="grid gap-x-8 gap-y-4 text-body sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-small text-muted-foreground sm:text-body">
            Username
          </dt>
          <dd className="font-medium break-all">{profile.username}</dd>
          <dt className="text-small text-muted-foreground sm:text-body">
            Email
          </dt>
          <dd className="break-all">{profile.email ?? "—"}</dd>
        </dl>
      </Panel>

      <Panel id="profile-heading" title="Profile">
        <DisplayNameForm
          displayName={profile.display_name}
          username={profile.username}
        />
      </Panel>

      <div>
        <LogOutButton />
      </div>
    </div>
  );
}
