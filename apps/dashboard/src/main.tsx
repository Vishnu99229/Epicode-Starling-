import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { ToastHost } from './components/Toast'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

async function enableMocks() {
  // MSW loads only when VITE_USE_MOCKS is exactly "true".
  // Any other value (including unset / "false") uses VITE_API_BASE_URL directly.
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  })
}

void enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <ToastHost />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
})
