/** Card-shaped placeholder while the deck loads (spec 05 #20): no spinner. */
export function DeckSkeleton() {
  return (
    <div
      aria-hidden
      className="grid items-start gap-10 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-12"
    >
      <div className="aspect-[2/3] w-full max-w-[400px] animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none" />
      <div className="flex flex-col gap-4">
        <div className="h-8 w-3/4 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
        <div className="h-4 w-1/3 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
        <div className="mt-6 h-48 animate-pulse rounded-lg bg-surface-1 motion-reduce:animate-none" />
      </div>
    </div>
  );
}
