# Game Subscription Tracker

Track and compare game streaming/subscription services — Game Pass, EA Play, PS Plus, Ubisoft+, and more.

## Structure

- `frontend/` — React + TypeScript + Vite + Tailwind + TanStack Query
- `backend/` — TypeScript + Hono + Drizzle ORM (REST API + data pipeline)

## Architecture

The app uses a hybrid approach:

- **Frontend → Supabase direct**: Auth (login/signup/session), user profiles, avatar uploads. Simple reads/writes protected by Row Level Security.
- **Frontend → Hono backend API** (`/api/*`): Game search (trigram similarity on local Postgres), game detail lookups, import management, and future complex queries (services, plans, comparisons).
- **Backend only**: IGDB integration, game importer (bulk + incremental), daily cron jobs.

**Rule of thumb:** Single-table CRUD with RLS goes through Supabase directly. Joins, business logic, external APIs, or anything that will grow in complexity goes through the backend API.

## Game Data Pipeline

The backend imports games from IGDB into a local Postgres table (~186K games, ~107 MB). This powers instant search via trigram similarity instead of hitting the IGDB API on every query.

```bash
cd backend
pnpm import:bulk              # Full import (~186K games, ~9 min)
pnpm import:incremental       # Only new/updated games since last import
pnpm import:bulk -- --resume 45000   # Resume a failed bulk import from offset
```

A daily cron job (4:00 AM UTC) runs incremental imports automatically when the backend is running.

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
2. Fill in your Supabase credentials (project URL, anon key, database URL)
3. Add IGDB credentials to `backend/.env` (`IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`)
4. Run `make install` then start both dev servers
5. Run `pnpm import:bulk` from `backend/` to populate the games catalog
