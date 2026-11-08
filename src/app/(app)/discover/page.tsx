import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { getCurrentUser } from "@/features/auth/queries";
import { DiscoverView } from "@/features/search/components/discover-view";
import { type Filters, parseFilters } from "@/features/search/filters";
import {
  discoverHref,
  effectiveQuery,
  parseQuery,
  shouldSearch,
} from "@/features/search/logic";
import { getLatestYear, searchAnime } from "@/features/search/queries";
import type { SearchPage } from "@/features/search/types";
import { buildMetadata } from "@/lib/seo/metadata";

const base = buildMetadata({
  title: "Discover",
  description: "Search any anime by its English, romaji or Japanese title.",
  path: "/discover",
});

/** A search or filter page is thin and endless: not indexed (0018, 0020). */
export async function generateMetadata(
  props: PageProps<"/discover">,
): Promise<Metadata> {
  const params = await props.searchParams;
  const href = discoverHref(parseQuery(params.q), parseFilters(params));
  return href === "/discover" ? base : { ...base, robots: { index: false } };
}

// Discover: title search and filters (specs 09 and 10, 0018 and 0020). Public.
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
  const params = await searchParams;
  const query = parseQuery(params.q);
  const filters = parseFilters(params);
  const [user, first, latestYear] = await Promise.all([
    getCurrentUser(),
    firstPage(query, filters),
    getLatestYear(),
  ]);
  return (
    <DiscoverView
      // A new URL from a link starts fresh; typing and filtering never change it.
      key={discoverHref(query, filters)}
      initialQuery={query}
      initialFilters={filters}
      initialPage={first === "error" ? null : first}
      initialError={first === "error"}
      latestYear={latestYear}
      signedIn={user !== null}
    />
  );
}

/** The first page for the URL, so a shared link shows results at once. */
async function firstPage(
  query: string,
  filters: Filters,
): Promise<SearchPage | null | "error"> {
  if (!shouldSearch(query, filters)) return null;
  try {
    return await searchAnime(effectiveQuery(query), filters, 0);
  } catch {
    // The view shows its error state and Try again.
    return "error";
  }
}
