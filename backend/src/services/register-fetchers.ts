import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { sql } from 'drizzle-orm'
import type { Config } from '../config.js'
import type { Database } from '../db/index.js'
import { games } from '../db/schema.js'
import type { SubscriptionSyncer, FetcherResult } from './subscription-syncer.js'
import { fetchGeforceNowCatalog, GEFORCE_NOW_SLUG, GEFORCE_NOW_SOURCE } from './fetchers/geforce-now.js'
import { fetchGamePassCatalog, XBOX_SOURCE } from './fetchers/xbox-gamepass.js'
import { fetchNintendoCatalog, NINTENDO_ONLINE_SLUG, NINTENDO_SOURCE } from './fetchers/nintendo.js'
import { fetchPsPlusCatalog, PS_PLUS_EXTRA_SLUG, PS_PLUS_PREMIUM_SLUG, PS_PLUS_SOURCE } from './fetchers/ps-plus.js'
import { ItadService, ITAD_SOURCE } from './fetchers/itad.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export function registerAllFetchers(syncer: SubscriptionSyncer, config: Config, db?: Database) {
  // GeForce NOW — static JSON, most reliable
  syncer.registerFetcher('geforce-now', async (): Promise<FetcherResult[]> => {
    const games = await fetchGeforceNowCatalog()
    return [{
      serviceSlug: GEFORCE_NOW_SLUG,
      source: GEFORCE_NOW_SOURCE,
      games: games.map((g) => ({ title: g.title, externalId: g.steamUrl })),
    }]
  })

  // Xbox Game Pass + EA Play — public Microsoft API, single fetch for all tiers
  syncer.registerFetcher('xbox', async (): Promise<FetcherResult[]> => {
    const catalog = await fetchGamePassCatalog()

    const toFetcherGames = (list: typeof catalog.core) =>
      list.map((g) => ({ title: g.title, externalId: g.productId }))

    return [
      { serviceSlug: 'gamepass-core', source: XBOX_SOURCE, games: toFetcherGames(catalog.core) },
      { serviceSlug: 'gamepass-standard', source: XBOX_SOURCE, games: toFetcherGames(catalog.standard) },
      { serviceSlug: 'gamepass-ultimate', source: XBOX_SOURCE, games: toFetcherGames(catalog.ultimate) },
      { serviceSlug: 'ea-play', source: XBOX_SOURCE, games: toFetcherGames(catalog.eaPlay) },
    ]
  })

  // Ubisoft+ — use ITAD to check Ubisoft-published games for subscription status
  if (config.itadApiKey && db) {
    const itad = new ItadService(config.itadApiKey)
    syncer.registerFetcher('ubisoft-plus', async (): Promise<FetcherResult[]> => {
      // Get all Ubisoft-published games from our DB
      const ubisoftGames = await db
        .select({ title: games.title })
        .from(games)
        .where(sql`${games.publisher} ILIKE '%ubisoft%'`)

      if (ubisoftGames.length === 0) {
        console.log('[Ubisoft+] No Ubisoft games found in DB')
        return []
      }

      console.log(`[Ubisoft+] Checking ${ubisoftGames.length} Ubisoft games via ITAD...`)
      const titles = ubisoftGames.map((g) => g.title)

      // Look up ITAD IDs for these titles
      const idMap = await itad.lookupGames(titles)
      const itadIds = [...idMap.values()]

      if (itadIds.length === 0) {
        console.log('[Ubisoft+] No ITAD matches found')
        return []
      }

      // Check subscriptions for matched games
      const subs = await itad.getSubscriptions(itadIds)

      // Build reverse map: itadId -> title
      const idToTitle = new Map<string, string>()
      for (const [title, itadId] of idMap) {
        idToTitle.set(itadId, title)
      }

      // Collect games on ubisoft+ services
      const ubisoftPlusGames: { title: string }[] = []
      const ubisoftPremiumGames: { title: string }[] = []

      for (const sub of subs) {
        const title = idToTitle.get(sub.itadId) ?? sub.title
        for (const slug of sub.services) {
          if (slug === 'ubisoft-plus') ubisoftPlusGames.push({ title })
          if (slug === 'ubisoft-plus-premium') ubisoftPremiumGames.push({ title })
        }
      }

      const results: FetcherResult[] = []
      if (ubisoftPlusGames.length > 0) {
        results.push({ serviceSlug: 'ubisoft-plus', source: ITAD_SOURCE, games: ubisoftPlusGames })
      }
      if (ubisoftPremiumGames.length > 0) {
        results.push({ serviceSlug: 'ubisoft-plus-premium', source: ITAD_SOURCE, games: ubisoftPremiumGames })
      }

      return results
    })
  } else {
    syncer.registerFetcher('ubisoft-plus', async (): Promise<FetcherResult[]> => {
      console.log('[Ubisoft+] Skipped — no ITAD_API_KEY set (web scrape not available, client-side rendered)')
      return []
    })
  }

  // PS Plus — scrape PlatPrices catalog pages
  syncer.registerFetcher('ps-plus', async (): Promise<FetcherResult[]> => {
    const catalog = await fetchPsPlusCatalog()
    const results: FetcherResult[] = []

    if (catalog.extra.length > 0) {
      results.push({
        serviceSlug: PS_PLUS_EXTRA_SLUG,
        source: PS_PLUS_SOURCE,
        games: catalog.extra.map((g) => ({ title: g.title })),
      })
    }

    if (catalog.premium.length > 0) {
      results.push({
        serviceSlug: PS_PLUS_PREMIUM_SLUG,
        source: PS_PLUS_SOURCE,
        games: catalog.premium.map((g) => ({ title: g.title })),
      })
    }

    return results
  })

  // Nintendo Switch Online — web scrape
  syncer.registerFetcher('nintendo', async (): Promise<FetcherResult[]> => {
    const games = await fetchNintendoCatalog()
    return [{
      serviceSlug: NINTENDO_ONLINE_SLUG,
      source: NINTENDO_SOURCE,
      games: games.map((g) => ({ title: g.title })),
    }]
  })

  // Manual seeds — from JSON file
  syncer.registerFetcher('manual', async (): Promise<FetcherResult[]> => {
    const seedPath = join(__dirname, '..', 'data', 'manual-subscriptions.json')
    let seeds: Record<string, string[]>
    try {
      const raw = await readFile(seedPath, 'utf-8')
      seeds = JSON.parse(raw)
    } catch {
      console.log('[Sync] No manual-subscriptions.json found, skipping')
      return []
    }

    const results: FetcherResult[] = []
    for (const [slug, titles] of Object.entries(seeds)) {
      if (titles.length > 0) {
        results.push({
          serviceSlug: slug,
          source: 'manual',
          games: titles.map((title) => ({ title })),
        })
      }
    }
    return results
  })
}
