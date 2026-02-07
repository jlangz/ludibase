# Game Subscription Tracker

Track and compare game streaming/subscription services — Game Pass, EA Play, PS Plus, Ubisoft+, and more.

## Structure

- `frontend/` — React + TypeScript + Vite + Tailwind + TanStack Query
- `backend/` — TypeScript + Hono + Drizzle ORM (REST API + data pipeline)

## Development

```bash
make install          # Install all dependencies (frontend + backend)
make dev-frontend     # Start Vite dev server (http://localhost:5173)
make dev-backend      # Start Hono dev server (http://localhost:8080)
```

## Database

Drizzle schema and migrations live in `backend/`. Run from project root:

```bash
make db-push          # Push schema changes to Supabase
make db-generate      # Generate migration files
make db-migrate       # Run pending migrations
make db-studio        # Open Drizzle Studio (DB browser)
```

## Setup

1. Copy environment files:
   - `cp frontend/.env.local.example frontend/.env.local`
   - `cp backend/.env.example backend/.env`
2. Fill in your Supabase credentials
3. Run `make install` then start both dev servers
