import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

const controlClass =
  'w-full rounded-md border border-line bg-ground px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-live focus-visible:ring-offset-2 focus-visible:ring-offset-ground disabled:opacity-50'

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-text">{label}</span>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? <p className="text-xs text-fail">{error}</p> : null}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, props.className)} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlClass, props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, props.className)} />
}
