# LudiBase

Track game subscription services, compare prices, and manage your game collection.

## Structure

- `frontend/` — React + TypeScript + Vite + Tailwind + TanStack Query
- `backend/` — TypeScript + Hono + Drizzle ORM (REST API + data pipeline)

## Features

- **Game Database** — 186K games imported from IGDB with search, ratings, and metadata
- **Subscription Tracking** — Game Pass, PS Plus, GeForce NOW, EA Play, Ubisoft+, Nintendo Switch Online
- **Price Comparison** — Live prices from Steam, Xbox, and GOG with affiliate link support
- **User Collections** — Manual game tracking + Steam library import
- **Service Pages** — Dedicated browsing for each subscription service with tier comparisons
- **Gaming News** — Aggregated RSS feeds from major gaming outlets

## Environment

All environment variables live in a single `.env` file at the project root.

Required:
- `DATABASE_URL` — Supabase Postgres connection string
- `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` — for IGDB API
- `SUPABASE_URL` — for JWT verification
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — for frontend auth

Optional:
- `STEAM_API_KEY` — Steam library import
- `ITAD_API_KEY` — Ubisoft+ subscription data
- `PLAT_PRICES` — PlatPrices API
- `AFFILIATE_GOG`, `AFFILIATE_XBOX`, etc. — affiliate tracking codes

## Development

```bash
cd backend && pnpm install && pnpm dev     # Backend on :8080
cd frontend && pnpm install && pnpm dev    # Frontend on :5173
```

## Data Pipeline

```bash
cd backend
pnpm import:bulk              # Import all games from IGDB
pnpm import:incremental       # Import new/updated games
pnpm sync:subs                # Sync subscription service catalogs
pnpm sync:subs geforce-now    # Sync single service
pnpm bootstrap:store-ids      # Populate store ID mappings for pricing
```

Daily cron jobs run automatically: game import at 4:00 AM UTC, subscription sync at 5:00 AM UTC.

## Database

```bash
cd backend
pnpm db:push      # Push schema changes
pnpm db:studio    # Open Drizzle Studio
```
