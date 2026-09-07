import { flexRender } from '@tanstack/react-table'
import {
  getCoreRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAgents } from '@/api/agents'
import {
  useCampaign,
  usePauseCampaign,
  useStartCampaign,
  useStopCampaign,
} from '@/api/campaigns'
import { useCallLogs } from '@/api/analytics'
import { useContactLists } from '@/api/contacts'
import { CampaignStatusPill } from '@/components/campaigns/CampaignStatusPill'
import { PageHeader } from '@/components/PageHeader'
import { QueryErrorPanel } from '@/components/QueryErrorPanel'
import { toast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DetailSkeleton } from '@/components/skeletons/DetailSkeleton'
import { formatDateTime, formatDuration } from '@/lib/campaign-wizard'
import { cn } from '@/lib/utils'
import type { CallLog, CallOutcome, Campaign, CampaignStatus } from '@/types'

const OUTCOME_TONE: Record<CallOutcome, string> = {
  connected: 'bg-live',
  no_answer: 'bg-idle',
  busy: 'bg-warn',
  voicemail: 'bg-idle',
  failed: 'bg-fail',
  dnd: 'bg-idle',
  invalid: 'bg-fail',
  abandoned: 'bg-warn',
}

export function CampaignDetailPage() {
  const { id = '' } = useParams()
  const [stopOpen, setStopOpen] = useState(false)

  const { data: campaign, isLoading, isError, error, refetch } = useCampaign(id, {
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 5000 : false,
  })

  const { data: agents = [] } = useAgents()
  const { data: lists = [] } = useContactLists()
  const { data: callLogs = [] } = useCallLogs(id, { enabled: Boolean(id) })

  const pause = usePauseCampaign({ onSuccess: () => toast('Campaign paused') })
  const start = useStartCampaign({ onSuccess: () => toast('Campaign resumed') })
  const stop = useStopCampaign({
    onSuccess: () => {
      setStopOpen(false)
      toast('Campaign stopped')
    },
  })

  const agentName = agents.find((a) => a.id === campaign?.agentId)?.name
  const listName = lists.find((l) => l.id === campaign?.contactListId)?.name

  const recentCalls = useMemo(
    () =>
      [...callLogs]
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 20),
    [callLogs],
  )

  const outcomeBreakdown = useMemo(() => {
    const counts = new Map<CallOutcome, number>()
    for (const log of callLogs) {
      counts.set(log.outcome, (counts.get(log.outcome) ?? 0) + 1)
    }
    const total = callLogs.length || 1
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([outcome, count]) => ({
        outcome,
        count,
        pct: (count / total) * 100,
      }))
  }, [callLogs])

  const callColumns = useMemo<LegacyColumnDef<CallLog>[]>(
    () => [
      {
        accessorKey: 'callUuid',
        header: 'Call UUID',
        cell: (info) => (
          <span className="metric text-xs">{info.getValue<string>() ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'phoneE164',
        header: 'Number',
        cell: (info) => <span className="metric">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'outcome',
        header: 'Status',
        cell: (info) => {
          const outcome = info.getValue<CallOutcome>()
          return (
            <span className="text-xs capitalize text-muted">{outcome.replace('_', ' ')}</span>
          )
        },
      },
      {
        accessorKey: 'durationSec',
        header: 'Duration',
        cell: (info) => (
          <span className="metric">{formatDuration(info.getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'startedAt',
        header: 'Started at',
        cell: (info) => formatDateTime(info.getValue<string>()),
      },
    ],
    [],
  )

  const callsTable = useLegacyTable({
    data: recentCalls,
    columns: callColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Campaign" />
        <DetailSkeleton label="Loading campaign" />
      </div>
    )
  }

  if (isError || !campaign) {
    return (
      <div>
        <PageHeader title="Campaign" />
        <QueryErrorPanel
          message={error?.message ?? 'Campaign not found.'}
          hint="Check the campaign ID or return to the campaigns list."
          onRetry={() => void refetch()}
        />
        <Button className="mt-3" variant="outline" asChild>
          <Link to="/campaigns">Back to campaigns</Link>
        </Button>
      </div>
    )
  }

  const actions = campaignActions(campaign.status)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-text">{campaign.name}</h1>
            <CampaignStatusPill status={campaign.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {campaign.iravoiceCampaignName}
            {campaign.status === 'running' ? ' · refreshing every 5s' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions.canStart ? (
            <Button
              type="button"
              disabled={start.isPending}
              onClick={() => start.mutate(campaign.id)}
            >
              {campaign.status === 'paused' ? 'Resume' : 'Start'}
            </Button>
          ) : null}
          {actions.canPause ? (
            <Button
              type="button"
              variant="outline"
              disabled={pause.isPending}
              onClick={() => pause.mutate(campaign.id)}
            >
              Pause
            </Button>
          ) : null}
          {actions.canStop ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setStopOpen(true)}
            >
              Stop
            </Button>
          ) : null}
        </div>
      </header>

      <ProgressHero progress={campaign.progress} />

      {outcomeBreakdown.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Outcome breakdown</h2>
          <div className="space-y-2">
            {outcomeBreakdown.map(({ outcome, count, pct }) => (
              <div key={outcome} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 capitalize text-muted">
                  {outcome.replace('_', ' ')}
                </span>
                <div className="h-2 flex-1 overflow-hidden border border-line bg-ground">
                  <div
                    className={cn('h-full', OUTCOME_TONE[outcome])}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="metric w-12 text-right text-text">{count}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">Configuration</h2>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <ConfigItem label="Agent" value={agentName ?? campaign.agentId} />
          <ConfigItem label="Contact list" value={listName ?? campaign.contactListId} />
          <ConfigItem label="Calls / sec" value={String(campaign.pacing.targetCps)} />
          <ConfigItem label="Max concurrent" value={String(campaign.pacing.maxConcurrent)} />
          <ConfigItem label="Dial timeout" value={`${campaign.pacing.dialTimeoutSec}s`} />
          <ConfigItem label="Max attempts" value={String(campaign.pacing.maxAttempts)} />
          <ConfigItem
            label="Working hours"
            value={
              campaign.callingWindow.workingHours ??
              `${campaign.callingWindow.startLocal}–${campaign.callingWindow.endLocal}`
            }
          />
          <ConfigItem label="Timezone" value={campaign.callingWindow.timezone} />
          <ConfigItem label="Retry delay" value={`${campaign.pacing.retryDelayMinutes} min`} />
          <ConfigItem label="Retry on" value={campaign.pacing.retryOn.join(', ')} />
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">Recent calls</h2>
        {recentCalls.length === 0 ? (
          <p className="text-sm text-muted">No calls logged for this campaign yet.</p>
        ) : (
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-panel text-muted">
                {callsTable.getHeaderGroups().map((group) => (
                  <tr key={group.id} className="border-b border-line">
                    {group.headers.map((header) => (
                      <th key={header.id} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {callsTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={stopOpen}
        title="Stop campaign?"
        description={`This ends dialing for ${campaign.name}. Contacts already in progress may still complete.`}
        confirmLabel="Stop campaign"
        destructive
        loading={stop.isPending}
        onCancel={() => setStopOpen(false)}
        onConfirm={() => stop.mutate(campaign.id)}
      />
    </div>
  )
}

function ProgressHero({ progress }: { progress: Campaign['progress'] }) {
  const { total, attempted, connected, completed, failed, skipped } = progress
  const remaining = Math.max(0, total - attempted)
  const inFlight = Math.max(0, connected - completed)

  const segments = [
    { key: 'completed', value: completed, className: 'bg-live' },
    { key: 'in-flight', value: inFlight, className: 'bg-warn' },
    { key: 'failed', value: failed, className: 'bg-fail' },
    { key: 'skipped', value: skipped, className: 'bg-idle' },
    { key: 'remaining', value: remaining, className: 'bg-line' },
  ].filter((s) => s.value > 0)

  return (
    <section className="border border-line bg-panel px-5 py-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="Attempted" value={attempted} sub={`of ${total.toLocaleString('en-IN')}`} />
        <Metric label="Connected" value={connected} />
        <Metric label="Completed" value={completed} tone="text-live" />
        <Metric label="Failed" value={failed} tone="text-fail" />
      </div>
      <div className="mt-5 flex h-3 overflow-hidden border border-line bg-ground">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={seg.className}
            style={{ width: `${total > 0 ? (seg.value / total) * 100 : 0}%` }}
            title={`${seg.key}: ${seg.value}`}
          />
        ))}
      </div>
    </section>
  )
}

function Metric({
  label,
  value,
  sub,
  tone = 'text-text',
}: {
  label: string
  value: number
  sub?: string
  tone?: string
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('metric text-3xl font-semibold', tone)}>
        {value.toLocaleString('en-IN')}
      </p>
      {sub ? <p className="text-xs text-muted">{sub}</p> : null}
    </div>
  )
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 border-b border-line/60 py-1">
      <dt className="w-36 shrink-0 text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  )
}

function campaignActions(status: CampaignStatus) {
  switch (status) {
    case 'running':
      return { canStart: false, canPause: true, canStop: true }
    case 'paused':
      return { canStart: true, canPause: false, canStop: true }
    case 'draft':
    case 'scheduled':
      return { canStart: true, canPause: false, canStop: false }
    default:
      return { canStart: false, canPause: false, canStop: false }
  }
}
