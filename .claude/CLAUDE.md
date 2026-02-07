# Game Subscription Tracker — Project Brief

## What We're Building

A web service that tracks game streaming/subscription services (Game Pass, EA Play, PS Plus, Ubisoft+, etc.), compares prices across subscription tiers, shows game availability across platforms, and lets users track their owned game libraries.

**Known competitor:** gamepasscompare.com — existing fan site that lists games across Game Pass, EA Play, etc. Validates the idea but narrower in scope.

---

## Domain

Still finalizing. Looking for cheap, descriptive options like gamesubtracker.com, whichgamepass.com, trackgamesubs.com, or similar. Budget: as close to free as possible (no $7k domains).

---

## Tech Stack

### Frontend
- **React + TypeScript + Vite + Tailwind CSS**
- **TanStack Query** for data fetching
- Talks directly to Supabase via the JS client library with RLS policies for reads (game catalog, service listings, user data)

### Backend
- **TypeScript + Hono** (lightweight HTTP framework)
- **Drizzle ORM** for type-safe database queries and migrations
- Handles scheduled data fetching (scraping/polling game service APIs) via node-cron
- Writes results to Supabase Postgres
- Exposes REST API endpoints for server-side logic (manual refresh triggers, heavier comparison queries, etc.)

### Database
- **Postgres via Supabase** (free tier — 500MB, 50K monthly auth users, 1GB storage)
- Drizzle ORM on the backend TS side for queries and migrations

### Auth
- **Supabase Auth**

### Hosting (budget: ~$0-5/month)
- Frontend: Vercel or Cloudflare Pages (free)
- TS Backend: Fly.io free tier, Railway ($5/mo hobby), or Hetzner VPS (~$4/mo)
- Database: Supabase free tier

---

## Architecture

```
React frontend  ──→  Supabase (direct, via JS client + RLS for reads)
TS backend      ──→  Supabase Postgres (writes game/service data on cron schedule)
TS backend      ──→  REST endpoints (server-side logic, manual refresh, comparison queries)
```

- React frontend talks directly to Supabase for reads using RLS policies
- TS backend (Hono + Drizzle) is the sole writer for game catalog and service data (runs on cron)
- TS backend also serves REST endpoints for things that need server-side logic

---

## Data Model

Three layers:

### 1. Service Catalog
Subscription services and their plans/tiers with prices and platform availability.

### 2. Game Catalog
Unified game entries deduplicated across services. Uses IGDB or Steam API IDs as canonical references for deduplication.

### 3. User Layer
User subscriptions, owned games library, watchlist.

### Key Tables (planned, schema not yet built)
- `services` — Game Pass, EA Play, PS Plus, etc.
- `plans` — tiers within each service (e.g., Game Pass Core, Game Pass Ultimate)
- `games` — unified game catalog, deduplicated
- `plan_games` — junction table (which games are on which plans)
- `users` — via Supabase Auth
- `user_subscriptions` — which services/plans a user subscribes to
- `user_owned_games` — manually added or auto-imported owned games
- `user_watchlist` — games the user wants to track

---

## Build Phases

### Phase 1 — Foundation (weeks 1-2)
- Postgres schema in Supabase with Drizzle
- Model services, plans, games, plan-games junction
- Basic React frontend displaying subscription services and game libraries
- Full-stack loop working end to end

### Phase 2 — Data Pipeline (weeks 3-4)
- TS services pulling game lists from APIs (Xbox/Game Pass semi-public API, EA Play scraping, PS Plus lists)
- Store in Postgres via Drizzle
- Run on daily cron (node-cron)

### Phase 3 — Comparison & Search (weeks 5-6)
- Comparison UI — "show me games on both Game Pass and EA Play"
- Price tier breakdowns
- Search/filter
- Core React learning phase

### Phase 4 — User Accounts & Library (weeks 7-8)
- Auth via Supabase Auth
- Users mark subscriptions, manually add owned games
- Eventually connect Steam/Xbox/PSN APIs for auto-import
- Watchlist for notifications

---

## Learning Goals

This project is partly a learning exercise:
- Deepen React skills
- Learn Drizzle + Postgres patterns
- Learn Hono for backend API development

---

## Tooling & MCP Setup

### Supabase MCP
This project uses a Supabase MCP server scoped to this specific project via `project_ref`. When configuring in Claude Code:

```bash
# Project-scoped Supabase MCP for Claude Code
claude mcp add --transport http --scope project supabase \
  "https://mcp.supabase.com/mcp?project_ref=rcyonueeenpykpomyfpj"
```

### Important
- This is a **development project** — do not treat as production
- The Supabase MCP should be scoped to **this project only** (via project_ref)
- The backend Drizzle schema should stay in sync with the Supabase Postgres schema

---

## Current Status

- **Project planning:** Complete
- **Supabase project:** Needs to be created
- **Schema:** Not yet built — this is the next step
- **Frontend scaffold:** Complete (React + Vite + Tailwind + TanStack Query)
- **TS backend scaffold:** Complete (Hono + Drizzle + node-cron)

---

## Next Steps (in order)

1. Create Supabase project and grab project ref
2. Configure Supabase MCP in Claude Code (project-scoped)
3. Design and apply the Postgres schema via migrations
4. Set up RLS policies for frontend reads
5. Get the full-stack loop working (Phase 1)