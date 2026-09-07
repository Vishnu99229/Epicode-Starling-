# Starling dashboard

Operator UI for Starling — agents, contacts, campaigns, and analytics.

## Quick start (mocks)

```bash
cd apps/dashboard
npm install
npm run dev
```

Opens at http://localhost:5173. Default `.env.development`:

```env
VITE_USE_MOCKS=true
VITE_API_BASE_URL=/api
```

MSW intercepts `/api/*` and serves data from `src/mocks/fixtures/`. No backend required.

## Point at a real backend

1. Copy env and disable mocks:

```bash
cp .env.example .env.local
```

```env
VITE_USE_MOCKS=false
VITE_API_BASE_URL=https://your-api-host/v1
```

2. Run the dev server:

```bash
npm run dev
```

3. Ensure CORS allows the Vite origin, or proxy via your gateway.

When `VITE_USE_MOCKS` is not exactly `true`, `src/main.tsx` skips MSW entirely. All requests go through `src/api/client.ts` to `VITE_API_BASE_URL`.

**API contract:** see [`../../docs/frontend-api-contract.md`](../../docs/frontend-api-contract.md) for every endpoint, request, and response shape.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | Typecheck + production build → `dist/` |
| `npm run preview` | Serve production build locally |
| `npm run lint` | oxlint |

## Fixture data (mocks)

| Path | Contents |
|---|---|
| `src/mocks/fixtures/agents.ts` | Voice agents |
| `src/mocks/fixtures/contacts.ts` | Contact lists + rows |
| `src/mocks/fixtures/campaigns.ts` | Campaigns |
| `src/mocks/fixtures/analytics.ts` | Overview, stats, call logs |
| `src/mocks/handlers.ts` | MSW route handlers (in-memory stores) |
| `src/mocks/browser.ts` | MSW worker setup |

Fixtures are validated against Zod schemas on import (`assertFixtures`). Edit fixture files, save, and refresh — handlers clone seeds into mutable stores at startup.

To add a new endpoint: define the handler in `handlers.ts`, add the `api/*.ts` function + hook, and extend types in `src/types/`.

## File structure

```
apps/dashboard/
├── public/              # mockServiceWorker.js (MSW)
├── src/
│   ├── api/             # REST client + React Query hooks
│   ├── components/      # UI (shell, pills, skeletons, charts)
│   ├── hooks/           # useReducedMotion, etc.
│   ├── lib/             # Domain helpers (CSV, campaign wizard, analytics)
│   ├── mocks/           # MSW handlers + fixtures
│   ├── pages/           # Route screens
│   ├── types/           # Zod schemas + inferred TS types
│   ├── App.tsx          # Router + per-route error boundaries
│   ├── main.tsx         # MSW gate + React root
│   └── index.css        # Design tokens + a11y base styles
├── .env.development     # Default mock env
├── .env.example         # Template for real backend
├── tailwind.config.ts   # Token → utility mapping
└── vite.config.ts
```

## Design tokens

`ground` `panel` `line` `text` `muted` `live` `warn` `fail` `idle` — defined in `src/index.css`, mapped in `tailwind.config.ts`. Colour is for status only; layout stays quiet.

## Stack

React 18, TypeScript, Vite, React Router v6, TanStack Query / Table, Tailwind v4, shadcn-style primitives, MSW, react-hook-form + Zod, Recharts, Papaparse.
