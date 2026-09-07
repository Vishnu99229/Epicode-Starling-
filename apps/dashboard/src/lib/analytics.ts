import type { AnalyticsOverview, CampaignStats, CampaignStatsPoint } from '@/types'

export function mergeTimeSeries(series: CampaignStats[]): CampaignStatsPoint[] {
  if (series.length === 0) return []
  const len = series[0]!.timeSeries.length
  const merged: CampaignStatsPoint[] = []
  for (let i = 0; i < len; i++) {
    let attempted = 0
    let connected = 0
    let completed = 0
    let failed = 0
    let ts = series[0]!.timeSeries[i]!.ts
    for (const s of series) {
      const point = s.timeSeries[i]
      if (!point) continue
      ts = point.ts
      attempted += point.attempted
      connected += point.connected
      completed += point.completed
      failed += point.failed
    }
    merged.push({ ts, attempted, connected, completed, failed })
  }
  return merged
}

export function aggregateCampaignStats(series: CampaignStats[]) {
  const attempted = series.reduce((n, s) => n + s.attempted, 0)
  const connected = series.reduce((n, s) => n + s.connected, 0)
  const completed = series.reduce((n, s) => n + s.completed, 0)
  const durationWeighted = series.reduce((n, s) => n + s.avgDurationSec * s.attempted, 0)
  return {
    totalCalls: attempted,
    connectRate: attempted > 0 ? connected / attempted : 0,
    completionRate: attempted > 0 ? completed / attempted : 0,
    avgDurationSec: attempted > 0 ? durationWeighted / attempted : 0,
    timeSeries: mergeTimeSeries(series),
  }
}

export function outcomesFromLogs(
  logs: Array<{ outcome: string }>,
): AnalyticsOverview['byOutcome'] {
  const counts: Record<string, number> = {}
  for (const log of logs) {
    counts[log.outcome] = (counts[log.outcome] ?? 0) + 1
  }
  return counts
}

export function formatPercent(rate: number) {
  return `${(rate * 100).toFixed(1)}%`
}

export function formatHourLabel(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
