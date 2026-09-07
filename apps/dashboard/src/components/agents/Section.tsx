import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-line bg-panel p-3">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function RangeRow({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--live)]"
      />
      <span className="metric w-12 text-right text-xs text-muted">{value}</span>
    </div>
  )
}
