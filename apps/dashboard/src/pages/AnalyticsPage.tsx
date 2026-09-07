import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  useAnalyticsOverview,
  useCallLogs,
  useCampaignStats,
  useCampaignStatsList,
} from '@/api/analytics'
import { useCampaigns } from '@/api/campaigns'
import { MetricTile } from '@/components/analytics/MetricTile'
import { PageHeader } from '@/components/PageHeader'
import { QueryErrorPanel } from '@/components/QueryErrorPanel'
import { ChartSkeleton } from '@/components/skeletons/ChartSkeleton'
import { MetricRowSkeleton } from '@/components/skeletons/MetricRowSkeleton'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import {
  aggregateCampaignStats,
  formatHourLabel,
  formatPercent,
  outcomesFromLogs,
} from '@/lib/analytics'
import { formatDuration } from '@/lib/campaign-wizard'
import type { CallOutcome } from '@/types'

const CHART_GRID = 'var(--line)'
const CHART_MUTED = 'var(--muted)'
const CHART_LIVE = 'var(--live)'
const CHART_IDLE = 'var(--idle)'

const OUTCOME_ORDER: CallOutcome[] = [
  'connected',
  'no_answer',
  'busy',
  'voicemail',
  'failed',
  'dnd',
  'invalid',
  'abandoned',
]

export function AnalyticsPage() {
  const [campaignFilter, setCampaignFilter] = useState('all')
  const reducedMotion = useReducedMotion()

  const { data: overview, isLoading: overviewLoading, isError: overviewError, refetch } =
    useAnalyticsOverview()
  const { data: allStats = [] } = useCampaignStatsList()
  const { data: campaignStats } = useCampaignStats(campaignFilter, {
    enabled: campaignFilter !== 'all',
  })
  const { data: campaigns = [] } = useCampaigns()
  const { data: callLogs = [] } = useCallLogs(
    campaignFilter === 'all' ? undefined : campaignFilter,
  )

  const metrics = useMemo(() => {
    if (campaignFilter !== 'all' && campaignStats) {
      return {
        totalCalls: campaignStats.attempted,
        connectRate: campaignStats.connectRate,
        completionRate: campaignStats.completionRate,
        avgDurationSec: campaignStats.avgDurationSec,
        timeSeries: campaignStats.timeSeries.map((p) => ({
          label: formatHourLabel(p.ts),
          attempted: p.attempted,
          connected: p.connected,
        })),
      }
    }
    if (overview && allStats.length > 0) {
      const agg = aggregateCampaignStats(allStats)
      return {
        totalCalls: overview.callsToday,
        connectRate: overview.connectRateToday,
        completionRate: overview.completionRateToday,
        avgDurationSec: overview.avgDurationSecToday,
        timeSeries: agg.timeSeries.map((p) => ({
          label: formatHourLabel(p.ts),
          attempted: p.attempted,
          connected: p.connected,
        })),
      }
    }
    if (overview) {
      return {
        totalCalls: overview.callsToday,
        connectRate: overview.connectRateToday,
        completionRate: overview.completionRateToday,
        avgDurationSec: overview.avgDurationSecToday,
        timeSeries: [],
      }
    }
    return null
  }, [campaignFilter, campaignStats, overview, allStats])

  const outcomeData = useMemo(() => {
    const raw =
      campaignFilter === 'all'
        ? overview?.byOutcome ?? {}
        : outcomesFromLogs(callLogs)
    return OUTCOME_ORDER
      .map((outcome) => ({
        outcome: outcome.replace('_', ' '),
        count: raw[outcome] ?? 0,
      }))
      .filter((row) => row.count > 0)
  }, [campaignFilter, overview?.byOutcome, callLogs])

  const statsWithData = useMemo(
    () => allStats.map((s) => ({ id: s.campaignId, name: s.campaignName })),
    [allStats],
  )

  const animate = !reducedMotion

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Call outcomes, latency, and usage metrics."
        actions={
          <Button variant="outline" asChild>
            <Link to="/analytics/calls">Call logs</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56">
          <label className="mb-1 block text-sm text-text">Campaign</label>
          <Select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
          >
            <option value="all">All campaigns</option>
            {statsWithData.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            {campaigns
              .filter((c) => !statsWithData.some((s) => s.id === c.id))
              .map((c) => (
                <option key={c.id} value={c.id} disabled>
                  {c.name} (no stats)
                </option>
              ))}
          </Select>
        </div>
      </div>

      {overviewLoading ? (
        <div className="space-y-6">
          <MetricRowSkeleton />
          <ChartSkeleton label="Loading attempted vs connected chart" />
          <ChartSkeleton label="Loading outcome distribution chart" />
        </div>
      ) : overviewError ? (
        <QueryErrorPanel
          message="Failed to load analytics."
          hint="Check the API connection and try again."
          onRetry={() => void refetch()}
        />
      ) : metrics ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label="Total calls"
              value={metrics.totalCalls.toLocaleString('en-IN')}
            />
            <MetricTile label="Connect rate" value={formatPercent(metrics.connectRate)} />
            <MetricTile
              label="Avg duration"
              value={formatDuration(Math.round(metrics.avgDurationSec))}
            />
            <MetricTile
              label="Completion rate"
              value={formatPercent(metrics.completionRate)}
            />
          </div>

          <section>
            <h2 className="mb-3 text-sm font-medium text-muted">Attempted vs connected</h2>
            <div className="border border-line bg-panel p-3">
              {metrics.timeSeries.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No time-series data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={metrics.timeSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: CHART_MUTED, fontSize: 11 }}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: CHART_MUTED, fontSize: 11 }}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--panel)',
                        border: '1px solid var(--line)',
                        borderRadius: 0,
                        boxShadow: 'none',
                      }}
                      labelStyle={{ color: 'var(--muted)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: CHART_MUTED }} />
                    <Line
                      type="monotone"
                      dataKey="attempted"
                      name="Attempted"
                      stroke={CHART_IDLE}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={animate}
                    />
                    <Line
                      type="monotone"
                      dataKey="connected"
                      name="Connected"
                      stroke={CHART_LIVE}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={animate}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-muted">Outcome distribution</h2>
            <div className="border border-line bg-panel p-3">
              {outcomeData.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No outcome data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={outcomeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="outcome"
                      tick={{ fill: CHART_MUTED, fontSize: 11 }}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: CHART_MUTED, fontSize: 11 }}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--ground)' }}
                      contentStyle={{
                        background: 'var(--panel)',
                        border: '1px solid var(--line)',
                        borderRadius: 0,
                        boxShadow: 'none',
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill={CHART_IDLE}
                      isAnimationActive={animate}
                      radius={0}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
