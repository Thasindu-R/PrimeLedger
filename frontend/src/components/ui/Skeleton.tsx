/**
 * The placeholder every async surface shows while it loads (FR-42).
 *
 * <p>A skeleton rather than a spinner because it reserves the space the content
 * will occupy, so the page does not jump when the data lands.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      // aria-hidden: a screen reader should hear the "Loading…" status the
      // container announces once, not one announcement per grey rectangle.
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-gray-100 ${className}`}
    />
  );
}

/** A skeleton standing in for a list, sized to the rows it will become. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

/** A skeleton standing in for a card of summary figures. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
    >
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-28 w-full" />
      ))}
    </div>
  );
}

/** A skeleton standing in for a chart panel. */
export function SkeletonChart({ className = 'h-72' }: { className?: string }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className={`w-full ${className}`} />
    </div>
  );
}
