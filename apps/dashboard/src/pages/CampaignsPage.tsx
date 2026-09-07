import { flexRender } from '@tanstack/react-table'
import {
  getCoreRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAgents } from '@/api/agents'
import { useCampaigns } from '@/api/campaigns'
import { useContactLists } from '@/api/contacts'
import { CampaignStatusPill } from '@/components/campaigns/CampaignStatusPill'
import { PageHeader } from '@/components/PageHeader'
import { QueryErrorPanel } from '@/components/QueryErrorPanel'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/campaign-wizard'
import type { Campaign } from '@/types'

function ProgressBar({ attempted, total }: { attempted: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (attempted / total) * 100) : 0
  return (
    <div className="flex min-w-32 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden border border-line bg-ground">
        <div className="h-full bg-live" style={{ width: `${pct}%` }} />
      </div>
      <span className="metric text-xs text-muted">
        {attempted.toLocaleString('en-IN')}/{total.toLocaleString('en-IN')}
      </span>
    </div>
  )
}

export function CampaignsPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useCampaigns()
  const { data: agents = [] } = useAgents()
  const { data: lists = [] } = useContactLists()

  const campaigns = useMemo(() => data ?? [], [data])
  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a.name])), [agents])
  const listMap = useMemo(() => new Map(lists.map((l) => [l.id, l.name])), [lists])

  const columns = useMemo<LegacyColumnDef<Campaign>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: (info) => <span className="font-medium">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => <CampaignStatusPill status={info.getValue<Campaign['status']>()} />,
      },
      {
        id: 'agent',
        header: 'Agent',
        accessorFn: (row) => agentMap.get(row.agentId) ?? row.agentId,
      },
      {
        id: 'contactList',
        header: 'Contact list',
        accessorFn: (row) => listMap.get(row.contactListId) ?? row.contactListId,
      },
      {
        id: 'progress',
        header: 'Progress',
        cell: ({ row }) => (
          <ProgressBar attempted={row.original.progress.attempted} total={row.original.progress.total} />
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: (info) => formatDateTime(info.getValue<string>()),
      },
    ],
    [agentMap, listMap],
  )

  const table = useLegacyTable({
    data: campaigns,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Outbound campaign control and pacing."
        actions={
          <Button asChild>
            <Link to="/campaigns/new">New campaign</Link>
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton columns={6} rows={6} label="Loading campaigns" />
      ) : isError ? (
        <QueryErrorPanel
          message={error.message}
          hint="Check the API connection and try again."
          onRetry={() => void refetch()}
        />
      ) : campaigns.length === 0 ? (
        <div className="border border-line bg-panel px-4 py-10 text-center">
          <p className="text-sm text-text">No campaigns yet.</p>
          <p className="mt-1 text-sm text-muted">
            Create a campaign to start outbound dialing.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/campaigns/new">New campaign</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-panel text-muted">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id} className="border-b border-line">
                  {group.headers.map((header) => (
                    <th key={header.id} scope="col" className="px-3 py-2 font-medium">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  className="cursor-pointer border-b border-line last:border-b-0 hover:bg-panel"
                  onClick={() => navigate(`/campaigns/${row.original.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/campaigns/${row.original.id}`)
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
