export function DetailSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={label} role="status">
      <div className="space-y-2 border-b border-line pb-4">
        <div className="skeleton-bar h-7 w-64 max-w-full" />
        <div className="skeleton-bar h-4 w-40" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="border border-line bg-panel px-4 py-3">
            <div className="skeleton-bar h-8 w-20" />
            <div className="skeleton-bar mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="border border-line bg-panel p-4">
        <div className="skeleton-bar mb-3 h-4 w-32" />
        <div className="skeleton-bar h-48 w-full" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-4 border-b border-line/60 py-2">
            <div className="skeleton-bar h-4 w-28" />
            <div className="skeleton-bar h-4 w-48" />
          </div>
        ))}
      </div>
    </div>
  )
}
