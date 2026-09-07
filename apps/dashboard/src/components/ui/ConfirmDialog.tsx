import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ground/80 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="w-full max-w-md border border-line bg-panel p-4"
      >
        <h3 id="confirm-dialog-title" className="text-base font-semibold text-text">
          {title}
        </h3>
        <p id="confirm-dialog-desc" className="mt-2 text-sm text-muted">{description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button ref={cancelRef} type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
