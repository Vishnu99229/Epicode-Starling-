import { flexRender } from '@tanstack/react-table'
import {
  getCoreRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useContactLists } from '@/api/contacts'
import { ContactListStatusPill } from '@/components/contacts/ContactListStatusPill'
import { PageHeader } from '@/components/PageHeader'
import { QueryErrorPanel } from '@/components/QueryErrorPanel'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { Button } from '@/components/ui/button'
import type { ContactList } from '@/types'

const columns: LegacyColumnDef<ContactList>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: (info) => <span className="font-medium">{info.getValue<string>()}</span>,
  },
  {
    accessorKey: 'contactCount',
    header: 'Contacts',
    cell: (info) => <span className="metric">{info.getValue<number>().toLocaleString('en-IN')}</span>,
  },
  {
    accessorKey: 'validCount',
    header: 'Valid',
    cell: (info) => <span className="metric text-live">{info.getValue<number>().toLocaleString('en-IN')}</span>,
  },
  {
    accessorKey: 'invalidCount',
    header: 'Invalid',
    cell: (info) => {
      const n = info.getValue<number>()
      return <span className={n > 0 ? 'metric text-fail' : 'metric'}>{n.toLocaleString('en-IN')}</span>
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (info) => <ContactListStatusPill status={info.getValue<ContactList['status']>()} />,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: (info) => formatDate(info.getValue<string>()),
  },
]

function formatDate(iso: string) {
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

export function ContactsPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useContactLists()
  const lists = useMemo(() => data ?? [], [data])

  const table = useLegacyTable({
    data: lists,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Campaign contact lists and DND flags."
        actions={
          <Button asChild>
            <Link to="/contacts/upload">Upload contacts</Link>
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton columns={6} rows={5} label="Loading contact lists" />
      ) : isError ? (
        <QueryErrorPanel
          message={error.message}
          hint="Check the API connection and try again."
          onRetry={() => void refetch()}
        />
      ) : lists.length === 0 ? (
        <div className="border border-line bg-panel px-4 py-10 text-center">
          <p className="text-sm text-text">No contact lists yet.</p>
          <p className="mt-1 text-sm text-muted">
            Upload a CSV to create your first list for campaigns.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/contacts/upload">Upload contacts</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
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
                  onClick={() => navigate(`/contacts/${row.original.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/contacts/${row.original.id}`)
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
