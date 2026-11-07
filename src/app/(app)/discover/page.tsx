import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { getCurrentUser } from "@/features/auth/queries";
import { DiscoverView } from "@/features/search/components/discover-view";
import { isSearchable, parseQuery } from "@/features/search/logic";
import { searchAnime } from "@/features/search/queries";
import type { SearchPage } from "@/features/search/types";
import { buildMetadata } from "@/lib/seo/metadata";

const base = buildMetadata({
  title: "Discover",
  description: "Search any anime by its English, romaji or Japanese title.",
  path: "/discover",
});

/** A `?q=` results page is thin and endless: not indexed (0018). */
export async function generateMetadata(
  props: PageProps<"/discover">,
): Promise<Metadata> {
  const { q } = await props.searchParams;
  return parseQuery(q) ? { ...base, robots: { index: false } } : base;
}

// Discover: title search for now (spec 09, decision 0018). Public.
export default function DiscoverPage(props: PageProps<"/discover">) {
  return (
    <Suspense
      fallback={
        <h1 className="font-display text-title-l font-extrabold tracking-tight">
          Discover
        </h1>
      }
    >
      <Discover searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Discover({
  searchParams,
}: {
  searchParams: PageProps<"/discover">["searchParams"];
}) {
  // Results and your state are per request.
  await connection();
  const query = parseQuery((await searchParams).q);
  const [user, first] = await Promise.all([getCurrentUser(), firstPage(query)]);
  return (
    <DiscoverView
      // A new `?q=` from a link starts fresh; typing never changes it.
      key={query}
      initialQuery={query}
      initialPage={first === "error" ? null : first}
      initialError={first === "error"}
      signedIn={user !== null}
    />
  );
}

/** The first page for `?q=` on load, so a shared link shows results at once. */
async function firstPage(query: string): Promise<SearchPage | null | "error"> {
  if (!isSearchable(query)) return null;
  try {
    return await searchAnime(query, 0);
  } catch {
    // The view shows its error state and Try again.
    return "error";
  }
}
