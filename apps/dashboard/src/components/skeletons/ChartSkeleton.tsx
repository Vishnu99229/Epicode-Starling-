export function ChartSkeleton({ label = 'Loading chart' }: { label?: string }) {
  return (
    <div
      className="border border-line bg-panel p-3"
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      <div className="skeleton-bar mb-3 h-4 w-40" />
      <div className="skeleton-bar h-[280px] w-full" />
    </div>
  )
}
