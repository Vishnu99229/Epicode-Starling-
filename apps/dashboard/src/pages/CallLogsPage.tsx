import { flexRender } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getPaginationRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy'
import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useCallLogs } from '@/api/analytics'
import { useCampaigns } from '@/api/campaigns'
import { PageHeader } from '@/components/PageHeader'
import { QueryErrorPanel } from '@/components/QueryErrorPanel'
import { toast } from '@/components/Toast'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { formatDateTime, formatDuration } from '@/lib/campaign-wizard'
import { cn } from '@/lib/utils'
import type { CallLog, CallOutcome } from '@/types'

const PAGE_SIZE = 25

const STATUS_OPTIONS: Array<{ value: 'all' | CallOutcome; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'connected', label: 'Connected' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'failed', label: 'Failed' },
  { value: 'dnd', label: 'DND' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'abandoned', label: 'Abandoned' },
]

function truncateUuid(uuid: string | null) {
  if (!uuid) return '—'
  if (uuid.length <= 14) return uuid
  return `${uuid.slice(0, 8)}…${uuid.slice(-4)}`
}

export function CallLogsPage() {
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | CallOutcome>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: campaigns = [] } = useCampaigns()
  const campaignId = campaignFilter === 'all' ? undefined : campaignFilter
  const { data: logs = [], isLoading, isError, error, refetch } = useCallLogs(campaignId)

  const campaignMap = useMemo(
    () => new Map(campaigns.map((c) => [c.id, c.name])),
    [campaigns],
  )

  const filtered = useMemo(() => {
    return logs
      .filter((row) => statusFilter === 'all' || row.outcome === statusFilter)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  }, [logs, statusFilter])

  const columns = useMemo<LegacyColumnDef<CallLog>[]>(
    () => [
      {
        accessorKey: 'callUuid',
        header: 'Call UUID',
        cell: (info) => {
          const uuid = info.getValue<string | null>()
          if (!uuid) return <span className="text-muted">—</span>
          return (
            <button
              type="button"
              className="metric font-mono text-xs text-text hover:text-live"
              title={uuid}
              onClick={(e) => {
                e.stopPropagation()
                void navigator.clipboard.writeText(uuid).then(() => toast('Copied'))
              }}
            >
              {truncateUuid(uuid)}
            </button>
          )
        },
      },
      {
        id: 'campaign',
        header: 'Campaign',
        accessorFn: (row) => campaignMap.get(row.campaignId) ?? row.campaignId,
      },
      {
        accessorKey: 'phoneE164',
        header: 'Number',
        cell: (info) => <span className="metric">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'outcome',
        header: 'Status',
        cell: (info) => (
          <span className="capitalize text-muted">
            {info.getValue<CallOutcome>().replace('_', ' ')}
          </span>
        ),
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
        header: 'Started',
        cell: (info) => formatDateTime(info.getValue<string>()),
      },
    ],
    [campaignMap],
  )

  const table = useLegacyTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZE } },
  })

  const pageIndex = table.getState().pagination.pageIndex

  return (
    <div>
      <PageHeader
        title="Call logs"
        description="Recent call attempts with outcomes and transcripts."
        actions={
          <Button variant="outline" asChild>
            <Link to="/analytics">Overview</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-48">
          <label className="mb-1 block text-sm text-text">Campaign</label>
          <Select
            value={campaignFilter}
            onChange={(e) => {
              setCampaignFilter(e.target.value)
              table.setPageIndex(0)
            }}
          >
            <option value="all">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-40">
          <label className="mb-1 block text-sm text-text">Status</label>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | CallOutcome)
              table.setPageIndex(0)
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton columns={6} rows={10} label="Loading call logs" />
      ) : isError ? (
        <QueryErrorPanel
          message={error.message}
          hint="Check filters and try again."
          onRetry={() => void refetch()}
        />
      ) : filtered.length === 0 ? (
        <div className="border border-line bg-panel px-4 py-8 text-center">
          <p className="text-sm text-text">No calls match this filter.</p>
          <p className="mt-1 text-sm text-muted">Change campaign or status filters.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-panel text-muted">
                {table.getHeaderGroups().map((group) => (
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
                {table.getRowModel().rows.map((row) => {
                  const expanded = expandedId === row.original.id
                  const hasTranscript = Boolean(row.original.transcript)
                  return (
                    <Fragment key={row.id}>
                      <tr
                        key={row.id}
                        className={cn(
                          'border-b border-line hover:bg-panel',
                          hasTranscript && 'cursor-pointer',
                        )}
                        onClick={() => {
                          if (!hasTranscript) return
                          setExpandedId(expanded ? null : row.original.id)
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                      {expanded && row.original.transcript ? (
                        <tr key={`${row.id}-transcript`} className="border-b border-line bg-ground">
                          <td colSpan={columns.length} className="px-3 py-3">
                            <p className="mb-1 text-xs font-medium text-muted">Transcript</p>
                            <pre className="whitespace-pre-wrap font-mono text-xs text-text">
                              {row.original.transcript}
                            </pre>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>
              Showing {pageIndex * PAGE_SIZE + 1}–
              {Math.min((pageIndex + 1) * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length.toLocaleString('en-IN')}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                Previous
              </Button>
              <span className="metric text-text">
                Page {pageIndex + 1} of {table.getPageCount()}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
