export function BuilderSkeleton() {
  return (
    <div className="flex h-full min-h-64" aria-busy="true" aria-label="Loading builder" role="status">
      <div className="hidden w-52 shrink-0 border-r border-line bg-panel p-3 sm:block">
        <div className="skeleton-bar mb-3 h-8 w-full" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton-bar mb-2 h-6 w-full" />
        ))}
      </div>
      <div className="flex-1 p-4 space-y-4">
        <div className="skeleton-bar h-10 w-full max-w-xl" />
        <div className="skeleton-bar h-6 w-64" />
        <div className="skeleton-bar h-72 w-full" />
      </div>
    </div>
  )
}
