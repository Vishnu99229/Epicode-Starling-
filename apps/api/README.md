# Starling API

Fastify control-plane HTTP API.

## Prerequisites

```bash
docker compose up -d postgres
./db/migrate.sh
```

## Run locally

```bash
cd apps/api
npm install
npm run dev
```

Listens on **http://localhost:3000** by default.

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | `postgres://starling:starling@127.0.0.1:5433/starling?sslmode=disable` |
| `PORT` | `3000` |
| `CORS_ORIGIN` | `http://localhost:5173` |

Load env from repo-root `.env` (see `.env.example`).

## Point the dashboard at the API

In `apps/dashboard/.env.local`:

```env
VITE_USE_MOCKS=false
VITE_API_BASE_URL=http://localhost:3000/api
```

## Contacts endpoints

| Method | Path |
|--------|------|
| GET | `/api/contact-lists` |
| GET | `/api/contact-lists/:id` |
| GET | `/api/contact-lists/:id/contacts?search=&status=&page=&limit=` |
| POST | `/api/contact-lists/upload` |
| POST | `/api/contact-lists/:id/validate` |
