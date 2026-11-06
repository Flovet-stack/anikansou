/** First focusable element on every page: jumps past the navigation. */
export function SkipLink() {
  return (
    <a
      href="#content"
      className="fixed top-3 left-3 z-50 -translate-y-24 rounded-full bg-kohaku px-5 py-3 font-semibold text-on-accent transition-transform duration-(--duration-fast) ease-standard focus-visible:translate-y-0"
    >
      Skip to content
    </a>
  );
}
