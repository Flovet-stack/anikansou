/** Skeleton cards while a shelf loads (spec 07 #14): no spinner. */
export function LibrarySkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex gap-2">
        {[0, 1, 2].map((tab) => (
          <div
            key={tab}
            className="h-11 w-28 animate-pulse rounded-full bg-surface-1 motion-reduce:animate-none"
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 min-[600px]:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] min-[600px]:gap-x-8 min-[600px]:gap-y-10">
        {Array.from({ length: 8 }, (_, card) => (
          <li key={card} className="flex flex-col gap-2">
            <div className="aspect-[2/3] animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none" />
            <div className="h-5 w-4/5 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
            <div className="h-4 w-1/2 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
          </li>
        ))}
      </ul>
    </div>
  );
}
