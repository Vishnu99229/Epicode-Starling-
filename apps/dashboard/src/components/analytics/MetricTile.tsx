import { cn } from '@/lib/utils'

export function MetricTile({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn('border border-line bg-panel px-4 py-3', className)}>
      <p className="metric text-2xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  )
}
