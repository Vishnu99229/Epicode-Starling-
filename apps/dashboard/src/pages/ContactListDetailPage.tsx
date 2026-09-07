import { flexRender } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getPaginationRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useContactList, useContacts } from '@/api/contacts'
import { ContactListStatusPill } from '@/components/contacts/ContactListStatusPill'
import { ContactRowStatusPill } from '@/components/contacts/ContactRowStatusPill'
import { PageHeader } from '@/components/PageHeader'
import { QueryErrorPanel } from '@/components/QueryErrorPanel'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { Button } from '@/components/ui/button'
import { Select, TextInput } from '@/components/ui/field'
import type { Contact, ContactRowStatus } from '@/types'

const PAGE_SIZE = 25
const STATUS_FILTERS: Array<{ value: 'all' | ContactRowStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'valid', label: 'Valid' },
  { value: 'invalid_number', label: 'Invalid' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'dnd', label: 'DND' },
]

function formatAttribute(value: string | number | boolean | undefined) {
  if (value === undefined || value === '') return '—'
  if (typeof value === 'number') return value.toLocaleString('en-IN')
  return String(value)
}

export function ContactListDetailPage() {
  const { id = '' } = useParams()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ContactRowStatus>('all')

  const listQuery = useContactList(id)
  const contactsQuery = useContacts(id)

  const list = listQuery.data
  const allContacts = contactsQuery.data ?? []

  const attributeColumns = useMemo(() => {
    if (list?.columns?.length) return list.columns
    const keys = new Set<string>()
    for (const row of allContacts) {
      for (const key of Object.keys(row.attributes)) keys.add(key)
    }
    return [...keys].sort()
  }, [list?.columns, allContacts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allContacts.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!q) return true
      const haystack = [
        row.phoneE164,
        row.displayName ?? '',
        ...attributeColumns.map((col) => String(row.attributes[col] ?? '')),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [allContacts, attributeColumns, search, statusFilter])

  const columns = useMemo<LegacyColumnDef<Contact>[]>(() => {
    const base: LegacyColumnDef<Contact>[] = [
      {
        accessorKey: 'phoneE164',
        header: 'Phone',
        cell: (info) => <span className="metric">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'displayName',
        header: 'Name',
        cell: (info) => info.getValue<string>() ?? '—',
      },
      ...attributeColumns.map((col) => ({
        id: `attr-${col}`,
        header: col,
        accessorFn: (row: Contact) => row.attributes[col],
        cell: (info: { getValue: () => unknown }) => (
          <span className="metric">{formatAttribute(info.getValue() as string | number | boolean)}</span>
        ),
      })),
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => <ContactRowStatusPill status={info.getValue<ContactRowStatus>()} />,
      },
    ]
    return base
  }, [attributeColumns])

  const table = useLegacyTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZE } },
  })

  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex

  if (listQuery.isLoading || contactsQuery.isLoading) {
    return (
      <div>
        <PageHeader title="Contact list" />
        <TableSkeleton columns={6} rows={8} label="Loading contacts" />
      </div>
    )
  }

  if (listQuery.isError) {
    return (
      <div>
        <PageHeader title="Contact list" />
        <QueryErrorPanel
          message={listQuery.error.message}
          hint="Return to Contacts and pick a list, or retry."
          onRetry={() => void listQuery.refetch()}
        />
      </div>
    )
  }

  if (!list) {
    return (
      <div>
        <PageHeader title="Contact list" />
        <div className="border border-line bg-panel px-4 py-6">
          <p className="text-sm text-text">List not found.</p>
          <Button className="mt-3" variant="outline" asChild>
            <Link to="/contacts">Back to contacts</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={list.name}
        description={
          list.sourceFilename
            ? `${list.sourceFilename} · ${list.contactCount.toLocaleString('en-IN')} rows`
            : `${list.contactCount.toLocaleString('en-IN')} rows`
        }
        actions={
          <Button variant="outline" asChild>
            <Link to="/contacts/upload">Upload contacts</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ContactListStatusPill status={list.status} />
        <span className="text-sm text-muted">
          {list.validCount.toLocaleString('en-IN')} valid ·{' '}
          <span className="text-fail">{list.invalidCount.toLocaleString('en-IN')} invalid</span> ·{' '}
          <span className="text-warn">{list.duplicateCount.toLocaleString('en-IN')} duplicate</span>
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-sm text-text">Search</label>
          <TextInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              table.setPageIndex(0)
            }}
            placeholder="Phone, name, or attribute"
          />
        </div>
        <div className="min-w-40">
          <label className="mb-1 block text-sm text-text">Validation status</label>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | ContactRowStatus)
              table.setPageIndex(0)
            }}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {contactsQuery.isError ? (
        <QueryErrorPanel
          message={contactsQuery.error.message}
          hint="Reload contacts for this list."
          onRetry={() => void contactsQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <div className="border border-line bg-panel px-4 py-8 text-center">
          <p className="text-sm text-text">No contacts match this filter.</p>
          <p className="mt-1 text-sm text-muted">Clear search or change the validation filter.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-[720px] text-left text-sm">
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
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0 hover:bg-panel">
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
                Page {pageIndex + 1} of {pageCount}
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
