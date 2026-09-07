import { useCallback, useState } from 'react'

type Toast = { id: number; message: string }

let pushToast: ((message: string) => void) | null = null

export function toast(message: string) {
  pushToast?.(message)
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([])

  pushToast = useCallback((message: string) => {
    const id = Date.now()
    setItems((prev) => [...prev, { id, message }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 2800)
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="border border-line bg-panel px-3 py-2 text-sm text-text"
        >
          {item.message}
        </div>
      ))}
    </div>
  )
}
