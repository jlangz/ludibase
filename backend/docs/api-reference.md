# LudiBase API Reference

**Production**: `https://api.ludibase.com`
**Staging**: `https://uqe56eoqp8.execute-api.us-east-1.amazonaws.com/staging`

## Authentication

Authenticated endpoints require a Supabase JWT in the `Authorization` header:
```
Authorization: Bearer <supabase_access_token>
```

Admin endpoints require the `x-admin-key` header:
```
x-admin-key: <admin_key>
```

---

## Health

### GET /health
Check API and database status.

**Response:**
```json
{ "status": "ok", "database": "ok" }
```

---

## Games

### GET /games/search
Search games by title using trigram similarity.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `q` | string | Yes | — | Search query (max 200 chars) |
| `limit` | number | No | 20 | Max results (max 100) |

**Response:** Array of game objects, sorted by similarity.

### GET /games/search/filtered
Search with subscription service filtering and pagination.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `q` | string | No | — | Search query |
| `services` | string | No | — | Comma-separated service slugs |
| `page` | number | No | 1 | Page number |
| `pageSize` | number | No | 20 | Results per page (max 100) |

**Response:**
```json
{ "games": [...], "total": 150, "page": 1, "pageSize": 20 }
```

Service slugs are automatically expanded by tier (e.g., `gamepass-ultimate` includes `gamepass-standard` and `gamepass-core`).

### GET /games/popular
Most popular games ranked by rating count × aggregated rating.

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `limit` | number | No | 20 |
| `page` | number | No | 1 |

### GET /games/:igdbId
Get a single game by IGDB ID. Checks local cache first, fetches from IGDB if not found.

**Response:** Game object with `cached: boolean` flag.

### GET /games/:igdbId/prices
Get current prices across stores (Steam, Xbox, GOG).

**Response:**
```json
{
  "prices": [
    {
      "store": "steam",
      "storeName": "Steam",
      "price": 39.99,
      "originalPrice": 59.99,
      "discount": 33,
      "currency": "USD",
      "url": "https://store.steampowered.com/app/292030"
    }
  ]
}
```

Prices are cached for 1 hour. Affiliate tracking codes are applied to URLs when configured.

---

## Subscriptions

### GET /games/:igdbId/subscriptions
Get all active subscription services for a game.

**Response:**
```json
{
  "igdbId": 1942,
  "subscriptions": [
    { "service": "geforce-now", "source": "gfn-json", "addedAt": "2026-03-30T..." }
  ]
}
```

### GET /subscriptions/service/:slug
Browse all games on a specific subscription service.

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `page` | number | No | 1 |
| `pageSize` | number | No | 50 |

### GET /subscriptions/check
Batch check subscription availability for multiple games.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `igdbIds` | string | Yes | Comma-separated IGDB IDs (max 100) |

**Response:**
```json
{ "1942": ["geforce-now", "gamepass-ultimate"], "126459": [] }
```

### GET /subscriptions/stats
Game counts per subscription service.

**Response:**
```json
{ "services": [{ "slug": "geforce-now", "count": 1221 }, ...] }
```

### GET /subscriptions/family/:family
Browse a service family with per-game tier badges.

**Families:** `gamepass`, `ps-plus`, `geforce-now`, `ea-play`, `ubisoft-plus`, `nintendo-online`

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `q` | string | No | — | Search within service |
| `sort` | string | No | alpha-asc | alpha-asc, alpha-desc, rating-asc, rating-desc |
| `platform` | string | No | — | `pc` or `console` (Game Pass only) |
| `tier` | string | No | — | Filter to specific tier slug |
| `page` | number | No | 1 | |
| `pageSize` | number | No | 30 | Max 100 |

**Response:**
```json
{
  "family": "gamepass",
  "name": "Xbox Game Pass",
  "games": [{ "igdbId": 123, "title": "...", "tiers": ["gamepass-standard", "gamepass-ultimate"], ... }],
  "total": 642,
  "page": 1,
  "pageSize": 30,
  "tierCounts": { "gamepass-core": 89, "gamepass-standard": 606, "gamepass-ultimate": 642 },
  "tierExclusive": { "gamepass-core": 89, "gamepass-standard": 517, "gamepass-ultimate": 36 }
}
```

### POST /subscriptions/sync ⚠️ Admin
Trigger subscription data sync.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | No | Single fetcher name (e.g., `geforce-now`, `xbox`) |

---

## User Collection 🔒 Auth Required

### GET /collection
Get the authenticated user's game collection.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `page` | number | No | 1 | |
| `pageSize` | number | No | 20 | Max 100 |
| `storefront` | string | No | — | Filter by storefront (e.g., `steam`, `epic`) |
| `q` | string | No | — | Search within collection |
| `sort` | string | No | alpha-asc | Sort option |
| `platform` | string | No | — | `pc` or `console` |

**Response:**
```json
{
  "games": [{ "igdbId": 1942, "title": "...", "source": "steam", "ownedPlatforms": ["PC"], "storefronts": ["steam"], ... }],
  "total": 50,
  "storefronts": ["steam", "gog"]
}
```

### POST /collection/:igdbId
Add or update a game in the collection.

**Body:**
```json
{ "platforms": ["PC", "PS5"], "storefronts": ["steam", "epic"] }
```

### DELETE /collection/:igdbId
Remove a game from the collection.

### GET /collection/check
Batch check which games are in the user's collection.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `igdbIds` | string | Yes | Comma-separated IGDB IDs (max 100) |

**Response:**
```json
{ "1942": { "ownedPlatforms": ["PC"], "storefronts": ["steam"] }, "999": null }
```

### GET /collection/subscriptions
Games available through the user's subscription services.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `service` | string | No | Filter to specific service |
| `overlap` | string | No | `true` to only show games also in collection |
| `q` | string | No | Search query |
| `sort` | string | No | Sort option |
| `platform` | string | No | Platform filter |
| `page` | number | No | Page number |
| `pageSize` | number | No | Results per page |

### GET /collection/all
All games the user has access to (owned + subscription), deduplicated.

Same query params as `/collection/subscriptions` (minus `service` and `overlap`).

---

## Steam Integration 🔒 Auth Required

### GET /steam/connect
Get the Steam OpenID redirect URL to initiate account linking.

**Response:** `{ "url": "https://steamcommunity.com/openid/login?..." }`

### GET /steam/callback
Handles Steam OpenID redirect. No auth header — uses signed state token. Redirects browser to `/profile?steam=connected`.

### GET /steam/status
Get current user's Steam connection info.

**Response:**
```json
{
  "steamId": "76561198...",
  "steamUsername": "PlayerName",
  "steamAvatarUrl": "https://...",
  "connectedAt": "2026-04-01T...",
  "lastImportAt": "2026-04-05T..."
}
```

Returns `null` if no Steam account is connected.

### POST /steam/import
Import the user's Steam game library. Matches games by title to our database.

**Response:**
```json
{ "total": 269, "matched": 200, "unmatched": 69, "imported": 195 }
```

### DELETE /steam/disconnect
Remove the Steam connection. Keeps imported games in collection.

---

## News

### GET /news
Aggregated gaming news from RSS feeds (IGN, GameSpot, Kotaku, PC Gamer, Polygon, Rock Paper Shotgun).

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `limit` | number | No | 20 |

**Response:**
```json
{
  "items": [
    {
      "title": "...",
      "link": "https://...",
      "description": "...",
      "pubDate": "2026-04-15T...",
      "source": "IGN",
      "imageUrl": "https://..."
    }
  ]
}
```

Cached for 30 minutes.

---

## Import ⚠️ Admin

### POST /import/bulk
Start a full IGDB game import (~186K games). Runs async.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `resume` | number | No | Offset to resume from |

### POST /import/incremental
Import new/updated games since last import. Runs async.

### GET /import/status
Get the latest import run info.

---

## Game Object Shape

Fields returned by most game endpoints:

```json
{
  "igdbId": 1942,
  "title": "The Witcher 3: Wild Hunt",
  "slug": "the-witcher-3-wild-hunt",
  "summary": "...",
  "coverImageId": "coaarl",
  "platforms": ["PC", "PS5", "Series X|S", "Switch"],
  "genres": ["Role-playing (RPG)", "Adventure"],
  "category": null,
  "developer": "CD Projekt RED",
  "publisher": "WB Games",
  "aggregatedRating": 92,
  "ratingCount": 26,
  "firstReleaseDate": "2015-05-19T00:00:00.000Z",
  "igdbUrl": "https://www.igdb.com/games/the-witcher-3-wild-hunt"
}
```

Cover images: `https://images.igdb.com/igdb/image/upload/t_{size}/{coverImageId}.jpg`

Sizes: `thumb` (90x128), `cover_small` (90x128), `cover_big` (264x374), `720p` (1280x720)

---

## Service Slugs

| Slug | Service |
|------|---------|
| `gamepass-core` | Xbox Game Pass Core |
| `gamepass-standard` | Xbox Game Pass Standard |
| `gamepass-ultimate` | Xbox Game Pass Ultimate |
| `ps-plus-essential` | PS Plus Essential |
| `ps-plus-extra` | PS Plus Extra |
| `ps-plus-premium` | PS Plus Premium |
| `ea-play` | EA Play |
| `ubisoft-plus` | Ubisoft+ Classics |
| `ubisoft-plus-premium` | Ubisoft+ Premium |
| `nintendo-online` | Nintendo Switch Online |
| `nintendo-online-expansion` | Nintendo Switch Online + Expansion Pack |
| `geforce-now` | GeForce NOW |

## Storefront Slugs

| Slug | Store |
|------|-------|
| `steam` | Steam |
| `epic` | Epic Games Store |
| `gog` | GOG |
| `xbox` | Xbox / Microsoft Store |
| `playstation` | PlayStation Store |
| `nintendo` | Nintendo eShop |
| `ea-app` | EA App |
| `ubisoft` | Ubisoft Connect |
| `battle-net` | Battle.net |
| `physical` | Physical |
