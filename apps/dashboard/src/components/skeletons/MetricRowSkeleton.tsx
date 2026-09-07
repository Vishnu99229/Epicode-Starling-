export function MetricRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-busy="true"
      aria-label="Loading metrics"
      role="status"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border border-line bg-panel px-4 py-3">
          <div className="skeleton-bar h-8 w-24" />
          <div className="skeleton-bar mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}
