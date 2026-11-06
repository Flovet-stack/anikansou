import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { Deck } from "@/features/deck/components/deck";
import { DeckSkeleton } from "@/features/deck/components/deck-skeleton";
import { getDeckPage, getRatedCount } from "@/features/deck/queries";
import { getMyProfile } from "@/features/profiles/queries";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({ title: "Rate", path: "/rate" });

// The swipe-to-rate deck (spec 05).
export default function RatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-8">
          <h1 className="font-display text-title-l font-extrabold tracking-tight">
            Rate
          </h1>
          <DeckSkeleton />
        </div>
      }
    >
      <RateDeck />
    </Suspense>
  );
}

async function RateDeck() {
  // The proxy already redirects these cases with a real HTTP redirect. This is
  // the second check, so the page never renders for the wrong user. Deck data
  // is per user and per request, so it stays out of the prefetched shell.
  await connection();
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login?next=%2Frate");
  if (!profile.username) redirect("/auth/username?next=%2Frate");

  const [page, rated] = await Promise.all([getDeckPage(null), getRatedCount()]);
  return (
    <Deck
      initialCards={page.cards}
      initialDone={page.done}
      initialRated={rated}
    />
  );
}
