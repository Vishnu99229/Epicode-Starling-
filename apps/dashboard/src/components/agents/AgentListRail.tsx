import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAgents } from '@/api/agents'
import { StatusPill } from '@/components/StatusPill'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/field'
import { cn } from '@/lib/utils'

export function AgentListRail({
  search,
  onSearch,
}: {
  search: string
  onSearch: (value: string) => void
}) {
  const { id } = useParams()
  const { data = [] } = useAgents()
  const q = search.trim().toLowerCase()
  const rows = q ? data.filter((a) => a.name.toLowerCase().includes(q)) : data

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-panel">
      <div className="space-y-2 border-b border-line p-2">
        <TextInput
          placeholder="Search agents"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <Button className="w-full" size="sm" asChild>
          <Link to="/agents/new">New agent</Link>
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {rows.map((agent) => {
          const active = id === agent.id
          return (
            <Link
              key={agent.id}
              to={`/agents/${agent.id}`}
              className={cn(
                'block border-b border-line px-3 py-2 text-sm hover:bg-ground/60',
                active ? 'bg-ground text-text' : 'text-text',
              )}
            >
              <div className="truncate font-medium">{agent.name}</div>
              <div className="mt-1">
                <StatusPill status={agent.status} />
              </div>
            </Link>
          )
        })}
        {rows.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted">No agents match.</p>
        ) : null}
      </div>
    </aside>
  )
}

export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ground/70 p-4">
      <div className="w-full max-w-lg border border-line bg-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">{title}</h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
