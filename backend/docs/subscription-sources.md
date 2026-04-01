# Subscription Data Sources

How we track which games are available on each subscription service.

## Quick Reference

**Run sync**: `pnpm sync:subs` (all) or `pnpm sync:subs <source>` (single)

**Available sources**: `geforce-now`, `xbox`, `ea-play`, `ps-plus`, `ubisoft-plus`, `nintendo`, `manual`

**Cron**: Daily at 5:00 AM UTC (after game import at 4:00 AM)

**Required env vars**:

| Variable | Required by | Where to get it |
|----------|-------------|-----------------|
| `ITAD_API_KEY` | Ubisoft+ fetcher | Register app at `isthereanydeal.com/apps/my/` — use the `api_key` (not client_id) |
| `PLAT_PRICES` | PlatPrices per-game API (not currently used for sync) | Email `contact@platprices.com` |

All other fetchers (GeForce NOW, Xbox, EA Play, PS Plus, Nintendo) require no API keys.

## Active Sources

### GeForce NOW
- **Source**: Static JSON from Nvidia
- **URL**: `https://static.nvidiagrid.net/supported-public-game-list/locales/gfnpc-en-US.json`
- **Auth**: None
- **Rate limits**: None (static file)
- **Format**: JSON array with `{ title, store, steamUrl, Status }` per game
- **Reliability**: Excellent — official Nvidia-maintained file
- **Fetcher**: `fetchers/geforce-now.ts`
- **Notes**: Filter on `Status === "AVAILABLE"`. Includes store info (Steam, Epic, etc.)
- **Price tracking potential**: No pricing data in this endpoint

### Xbox Game Pass
- **Source**: Microsoft public catalog APIs
- **URLs**:
  - Catalog lists: `https://catalog.gamepass.com/sigls/v2?id={siglId}&market=US&language=en-US`
  - Product details: `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds={ids}&market=US&languages=en-US`
- **Auth**: None
- **Rate limits**: Undocumented; we use 200ms delays between batches
- **Format**: JSON
- **Collection IDs (sigls)**:
  - PC Game Pass: `fdd9e2a7-0fee-49f6-ad69-4354098401ff`
  - Console Game Pass: `29a81209-df6f-41fd-a528-2ae6b91f719c`
  - EA Play via Game Pass: `b8900d09-a491-44cc-916e-32b5acae621b`
- **Reliability**: Good — public API used by Microsoft's own site
- **Fetcher**: `fetchers/xbox-gamepass.ts`
- **Reference**: [NikkelM/Game-Pass-API](https://github.com/NikkelM/Game-Pass-API)
- **Alternatives**: [lucasromerodb/xbox-store-api](https://github.com/lucasromerodb/xbox-store-api)
- **Price tracking potential**: `displaycatalog` API returns MSRP and sale prices per product

### EA Play
- **Source**: Xbox Game Pass EA Play sigl (Microsoft public API)
- **How it works**: The Xbox catalog API includes a dedicated EA Play collection (sigl ID `b8900d09-a491-44cc-916e-32b5acae621b`). This is the same EA Play catalog available through Game Pass Ultimate.
- **Auth**: None
- **Reliability**: Excellent — same source as Game Pass data
- **Fetcher**: Handled in `register-fetchers.ts` via `fetchGamePassCatalog().eaPlay`
- **Notes**: EA's own page (`ea.com/ea-play/games`) is fully client-side rendered and cannot be scraped server-side. The Xbox catalog sigl is a much better source.
- **Alternatives**: ITAD API, EA website (would need headless browser)
- **Price tracking potential**: Xbox displaycatalog returns pricing for EA Play titles

### Ubisoft+
- **Source**: ITAD API (per-game subscription check)
- **How it works**: Queries our DB for Ubisoft-published games, resolves their ITAD IDs, then checks subscription status. ITAD distinguishes Classics vs Premium tiers.
- **Auth**: ITAD API key required (`ITAD_API_KEY` env var)
- **Reliability**: Good — ITAD is well-maintained
- **Fetcher**: Handled in `register-fetchers.ts` via `ItadService`
- **Notes**: Ubisoft's store page (`store.ubisoft.com/us/ubisoftplus/games`) is client-side rendered. ITAD covers both `ubisoftclassics` and `ubisoftpremium` services.
- **Alternatives**: [YoobieRE/ubisoft-db-scraper](https://github.com/YoobieRE/ubisoft-db-scraper) (Demux API, fragile), headless browser scraping
- **Price tracking potential**: ITAD has full price history for Ubisoft games

### Nintendo Switch Online
- **Source**: Web scrape of Nintendo's classic games page
- **URL**: `https://www.nintendo.com/us/online/nintendo-switch-online/classic-games/`
- **Auth**: None
- **Rate limits**: Standard web scraping courtesy
- **Format**: HTML
- **Reliability**: Good — catalog changes infrequently (monthly at most)
- **Fetcher**: `fetchers/nintendo.ts`
- **Notes**: ~150 games (base tier) + ~330 (Expansion Pack). Includes NES, SNES, N64, Game Boy, GBA, Genesis, GameCube
- **Price tracking potential**: N/A (subscription only, no individual purchase)

### Manual Seeds
- **Source**: `backend/src/data/manual-subscriptions.json`
- **Format**: `{ "service-slug": ["Game Title 1", ...] }`
- **Used for**: Amazon Luna, Humble Choice, and any service without an API
- **Notes**: Must be updated manually. Matched to games table via title similarity.

### PlayStation Plus (Extra / Premium)

- **Source**: Scrape PlatPrices catalog pages
- **URLs**:
  - Extra: `https://platprices.com/psplus/extra/?sort=alpha&page={n}`
  - Premium: `https://platprices.com/psplus/premium/?sort=alpha&page={n}`
- **Auth**: None (public pages)
- **Format**: HTML — game titles in `<div class='game-name'>` elements, paginated (~50/page)
- **Reliability**: Good — PlatPrices is well-maintained and actively updated
- **Fetcher**: `fetchers/ps-plus.ts`
- **Notes**: PlatPrices also has a per-game API (`platprices.com/api.php?key=...&name=...`) but no bulk catalog endpoint. Scraping the catalog pages is more efficient.
- **Rate limits**: 500ms delay between page fetches (polite scraping)
- **Alternatives**:
  - PlatPrices API (per-game lookup, `PLAT_PRICES` env var)
  - PSPrices API: `https://psprices.com/b2b/playstation-api/` ($100+/month)
  - PlayStation Store GraphQL: requires reCaptcha
- **Price tracking potential**: PlatPrices pages include base prices and discount info. The PlatPrices API returns detailed pricing per game.

## Fallback: IsThereAnyDeal (ITAD) API

Available as backup when native scrapers break. Currently used as the **primary** source for Ubisoft+.

- **Docs**: https://docs.isthereanydeal.com/
- **Auth**: API key required (env var `ITAD_API_KEY`)
- **Rate limits**: ~4 requests/second
- **Key endpoints**:
  - `GET /games/lookup/v1?key=...&title=...` — resolve a game title to an ITAD ID
  - `POST /games/subs/v1?key=...&country=...` — check subscriptions (body: JSON array of ITAD IDs)
- **Services covered**: Game Pass, EA Play/Pro, Ubisoft+ Classics/Premium, Prime Gaming
- **NOT covered**: PlayStation Plus, Nintendo Switch Online, Amazon Luna
- **Fetcher**: `fetchers/itad.ts`
- **Credentials**: ITAD provides three values when you register an app at `isthereanydeal.com/apps/my/`:
  - `client_id` — used for OAuth (not needed for our use case)
  - `client_secret` — used for OAuth (not needed for our use case)
  - `api_key` — used as query parameter for public endpoints (**this is what we use**)
- **Price tracking potential**: ITAD's primary purpose — has deal history, price alerts, historical lows across 30+ stores. Excellent candidate for future price tracking feature.

## Not Yet Implemented

### Humble Choice
- **Status**: Requires login + 2FA (SMS/Authy), monthly rotation model
- **API**: `https://hr-humblebundle.appspot.com/api/v1/`
- **Auth**: Username + password + reCaptcha + 2FA; header `X-Requested-By: hb_android_app`
- **Reference**: [MestreLion/humblebundle](https://github.com/MestreLion/humblebundle)
- **Notes**: Monthly bundle model, not persistent catalog. Using manual seeds for now.

### Amazon Luna
- **Status**: No documented public API
- **Workaround**: Community lists at [CloudDosage](https://clouddosage.com/gamelists/amazon-luna-games/)
- **Notes**: Using manual seeds for now

## Future: Price Tracking

Several sources provide pricing data that could power a price tracking feature:

| Source | Coverage | Free? | Notes |
|--------|----------|-------|-------|
| **ITAD** | 30+ PC stores | Yes (API key) | Deal history, historical lows, price alerts |
| **CheapShark** | PC stores | Yes (no key) | Docs: https://apidocs.cheapshark.com/ |
| **Xbox displaycatalog** | Xbox/PC | Yes | MSRP + sale prices per product |
| **PlatPrices / PSPrices** | PlayStation | Free / $100+/mo | PS Store pricing + PS Plus member pricing |
| **Nintendo eShop** | Switch | Yes | npm: `nintendo-switch-eshop` |
| **GG.deals** | Multi-platform | Unknown | https://gg.deals/ (may need scraping) |
