import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { LibrarySkeleton } from "@/features/library/components/library-skeleton";
import { LibraryView } from "@/features/library/components/library-view";
import { libraryHref } from "@/features/library/logic";
import { getLibraryPage, getShelfCounts } from "@/features/library/queries";
import { DEFAULT_SORT, parseShelf, parseSort } from "@/features/library/types";
import { getMyProfile } from "@/features/profiles/queries";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({ title: "Library", path: "/library" });

// Your saved anime, by shelf (spec 07, decision 0016).
export default function LibraryPage(props: PageProps<"/library">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <h1 className="font-display text-title-l font-extrabold tracking-tight">
            Library
          </h1>
          <LibrarySkeleton />
        </div>
      }
    >
      <Library searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Library({
  searchParams,
}: {
  searchParams: PageProps<"/library">["searchParams"];
}) {
  // The proxy already redirects signed-out visitors with a real redirect;
  // this is the second check. Library data is per user and per request.
  await connection();
  const params = await searchParams;
  const shelf = parseShelf(params.shelf);
  const urlSort = parseSort(params.sort);
  const sort = urlSort ?? DEFAULT_SORT;

  const profile = await getMyProfile();
  const here = encodeURIComponent(libraryHref(shelf, sort));
  if (!profile) redirect(`/auth/login?next=${here}`);
  if (!profile.username) redirect(`/auth/username?next=${here}`);

  const [page, counts] = await Promise.all([
    getLibraryPage(shelf, sort, null),
    getShelfCounts(),
  ]);
  return (
    <LibraryView
      // A new shelf or sort starts fresh.
      key={`${shelf}|${sort}`}
      shelf={shelf}
      sort={sort}
      sortInUrl={urlSort !== null}
      initialCards={page.cards}
      initialNext={page.next}
      initialCounts={counts}
    />
  );
}
