import { BarChart3, Bot, Menu, Megaphone, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'

const navItems = [
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
] as const

export function AppShell() {
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const builder =
    location.pathname.startsWith('/agents/') && location.pathname !== '/agents'

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  return (
    <div className="flex h-screen bg-ground text-text">
      {drawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ground/70 md:hidden"
          aria-label="Close navigation menu"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-52 shrink-0 flex-col border-r border-line bg-panel transition-transform duration-200 motion-reduce:transition-none',
          'md:static md:z-auto md:w-14 md:translate-x-0 lg:w-52',
          drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-3 lg:px-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">Starling</div>
            <div className="text-xs text-muted inline md:hidden lg:inline">Operator</div>
          </div>
          <button
            type="button"
            className="focus-ring rounded-md p-1 text-muted md:hidden"
            aria-label="Close navigation menu"
            onClick={() => setDrawerOpen(false)}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  cn(
                    'focus-ring flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors motion-reduce:transition-none',
                    isActive
                      ? 'border-line bg-ground text-text'
                      : 'border-transparent text-muted hover:bg-ground/60 hover:text-text',
                  )
                }
                end={item.to !== '/agents'}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="inline md:hidden lg:inline">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2 md:hidden">
          <button
            type="button"
            className="focus-ring rounded-md p-1.5 text-text"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <span className="text-sm font-semibold">Starling</span>
        </div>

        <main
          className={cn(
            'min-w-0 flex-1',
            builder ? 'relative overflow-hidden' : 'overflow-auto p-4',
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
