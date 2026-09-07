type TableSkeletonProps = {
  columns?: number
  rows?: number
  label?: string
}

export function TableSkeleton({
  columns = 5,
  rows = 8,
  label = 'Loading table',
}: TableSkeletonProps) {
  return (
    <div
      className="overflow-x-auto border border-line"
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-panel text-muted">
          <tr className="border-b border-line">
            {Array.from({ length: columns }, (_, i) => (
              <th key={i} scope="col" className="px-3 py-2 font-medium">
                <div className="skeleton-bar h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} className="border-b border-line last:border-b-0">
              {Array.from({ length: columns }, (_, c) => (
                <td key={c} className="px-3 py-2">
                  <div className="skeleton-bar h-4 max-w-32" style={{ width: `${60 + (c % 3) * 15}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
