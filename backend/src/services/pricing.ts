import { eq } from 'drizzle-orm'
import type { Database } from '../db/index'
import { games, gameStoreIds } from '../db/schema'

export interface GamePrice {
  store: string
  storeName: string
  price: number | null
  originalPrice: number | null
  discount: number
  currency: string
  url: string
}

const STORE_NAMES: Record<string, string> = {
  steam: 'Steam',
  xbox: 'Xbox / Microsoft Store',
  gog: 'GOG',
  humble: 'Humble Store',
  gmg: 'Green Man Gaming',
  fanatical: 'Fanatical',
  epic: 'Epic Games Store',
}

// In-memory cache: gameId -> { prices, fetchedAt }
const priceCache = new Map<number, { prices: GamePrice[]; fetchedAt: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export class PricingService {
  constructor(private db: Database) {}

  async getGamePrices(igdbId: number): Promise<GamePrice[]> {
    // Look up internal game ID
    const [game] = await this.db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.igdbId, igdbId))
      .limit(1)

    if (!game) return []

    // Check cache
    const cached = priceCache.get(game.id)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.prices
    }

    // Get all store IDs for this game
    const storeRows = await this.db
      .select({ store: gameStoreIds.store, storeId: gameStoreIds.storeId })
      .from(gameStoreIds)
      .where(eq(gameStoreIds.gameId, game.id))

    // Get the game title for stores that search by name (GOG)
    const [gameRow] = await this.db
      .select({ title: games.title })
      .from(games)
      .where(eq(games.id, game.id))
      .limit(1)

    // Fetch prices from mapped stores + title-search stores in parallel
    const pricePromises: Promise<GamePrice | null>[] = storeRows.map((row) => this.fetchPrice(row.store, row.storeId))

    // Always search GOG by title (no pre-mapped ID needed)
    if (gameRow?.title) {
      pricePromises.push(fetchGogPrice(gameRow.title))
    }

    const results = await Promise.all(pricePromises)
    const prices = results.filter((p): p is GamePrice => p !== null)

    // Sort by price (cheapest first), nulls last
    prices.sort((a, b) => {
      if (a.price === null && b.price === null) return 0
      if (a.price === null) return 1
      if (b.price === null) return -1
      return a.price - b.price
    })

    // Cache
    priceCache.set(game.id, { prices, fetchedAt: Date.now() })

    return prices
  }

  private async fetchPrice(store: string, storeId: string): Promise<GamePrice | null> {
    try {
      switch (store) {
        case 'steam': return await fetchSteamPrice(storeId)
        case 'xbox': return await fetchXboxPrice(storeId)
        default: return null
      }
    } catch (err) {
      console.warn(`[Pricing] Failed to fetch ${store} price for ${storeId}:`, err instanceof Error ? err.message : err)
      return null
    }
  }
}

async function fetchSteamPrice(appId: string): Promise<GamePrice | null> {
  const res = await fetch(`https://store.steampowered.com/api/appdetails/?appids=${appId}&cc=us`)
  if (!res.ok) return null

  const data = (await res.json()) as Record<string, { success: boolean; data?: { price_overview?: { initial: number; final: number; discount_percent: number; currency: string } } }>
  const entry = data[appId]
  if (!entry?.success || !entry.data?.price_overview) {
    // Free-to-play or no price data
    return {
      store: 'steam',
      storeName: STORE_NAMES.steam,
      price: 0,
      originalPrice: 0,
      discount: 0,
      currency: 'USD',
      url: `https://store.steampowered.com/app/${appId}`,
    }
  }

  const po = entry.data.price_overview
  return {
    store: 'steam',
    storeName: STORE_NAMES.steam,
    price: po.final / 100,
    originalPrice: po.initial / 100,
    discount: po.discount_percent,
    currency: po.currency,
    url: `https://store.steampowered.com/app/${appId}`,
  }
}

async function fetchXboxPrice(productId: string): Promise<GamePrice | null> {
  const res = await fetch(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${productId}&market=US&languages=en-US`)
  if (!res.ok) return null

  const data = (await res.json()) as {
    Products?: Array<{
      DisplaySkuAvailabilities?: Array<{
        Availabilities?: Array<{
          OrderManagementData?: {
            Price?: { ListPrice: number; MSRP: number; CurrencyCode: string }
          }
        }>
      }>
    }>
  }

  const product = data.Products?.[0]
  if (!product) return null

  // Find the first availability with price data
  for (const dsa of product.DisplaySkuAvailabilities ?? []) {
    for (const avail of dsa.Availabilities ?? []) {
      const price = avail.OrderManagementData?.Price
      if (price && price.MSRP > 0) {
        const discount = price.MSRP > price.ListPrice
          ? Math.round((1 - price.ListPrice / price.MSRP) * 100)
          : 0

        return {
          store: 'xbox',
          storeName: STORE_NAMES.xbox,
          price: price.ListPrice,
          originalPrice: price.MSRP,
          discount,
          currency: price.CurrencyCode,
          url: `https://www.xbox.com/games/store/p/${productId}`,
        }
      }
    }
  }

  return null
}

async function fetchGogPrice(title: string): Promise<GamePrice | null> {
  const res = await fetch(
    `https://catalog.gog.com/v1/catalog?limit=5&query=like:${encodeURIComponent(title)}&order=desc:score`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!res.ok) return null

  const data = (await res.json()) as {
    products?: Array<{
      title: string
      slug: string
      price?: {
        final: string
        base: string
        discount: string | null
        finalMoney?: { amount: string; currency: string; discount: string }
        baseMoney?: { amount: string; currency: string }
      }
    }>
  }

  // Find the best title match
  const products = data.products ?? []
  const exact = products.find((p) => p.title.toLowerCase() === title.toLowerCase())
  const match = exact ?? products[0]
  if (!match?.price?.finalMoney) return null

  const finalAmount = parseFloat(match.price.finalMoney.amount)
  const baseAmount = parseFloat(match.price.baseMoney?.amount ?? match.price.finalMoney.amount)
  const discountAmount = parseFloat(match.price.finalMoney.discount ?? '0')
  const discount = baseAmount > 0 && discountAmount > 0
    ? Math.round((discountAmount / baseAmount) * 100)
    : 0

  return {
    store: 'gog',
    storeName: STORE_NAMES.gog,
    price: finalAmount,
    originalPrice: baseAmount,
    discount,
    currency: match.price.finalMoney.currency,
    url: `https://www.gog.com/game/${match.slug}`,
  }
}
