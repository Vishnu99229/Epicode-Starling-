import { flexRender } from '@tanstack/react-table'
import {
  getCoreRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAgents } from '@/api/agents'
import { PageHeader } from '@/components/PageHeader'
import { QueryErrorPanel } from '@/components/QueryErrorPanel'
import { StatusPill } from '@/components/StatusPill'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { Button } from '@/components/ui/button'
import type { Agent } from '@/types'

const columns: LegacyColumnDef<Agent>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: (info) => <span className="font-medium">{info.getValue<string>()}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (info) => <StatusPill status={info.getValue<Agent['status']>()} />,
  },
  {
    id: 'llm',
    header: 'LLM model',
    accessorFn: (row) => row.llm.model,
  },
  {
    id: 'tts',
    header: 'TTS voice',
    accessorFn: (row) => row.tts.voice,
  },
  {
    accessorKey: 'updatedAt',
    header: 'Updated',
    cell: (info) => formatUpdated(info.getValue<string>()),
  },
]

function formatUpdated(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AgentsPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useAgents()
  const agents = useMemo(() => data ?? [], [data])

  const table = useLegacyTable({
    data: agents,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Voice agents and bot configurations."
        actions={
          <Button asChild>
            <Link to="/agents/new">New agent</Link>
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton columns={5} rows={6} label="Loading agents" />
      ) : isError ? (
        <QueryErrorPanel
          message={error.message}
          hint="Check the API connection and try again."
          onRetry={() => void refetch()}
        />
      ) : agents.length === 0 ? (
        <div className="border border-line bg-panel px-4 py-10 text-center">
          <p className="text-sm text-text">No agents yet.</p>
          <p className="mt-1 text-sm text-muted">
            Create the first voice agent to start campaigns.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/agents/new">New agent</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
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
                  onClick={() => navigate(`/agents/${row.original.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/agents/${row.original.id}`)
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
