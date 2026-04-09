import { eq } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { games, gameStoreIds } from '../db/schema.js'

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

    if (storeRows.length === 0) return []

    // Fetch prices from all stores in parallel
    const pricePromises = storeRows.map((row) => this.fetchPrice(row.store, row.storeId))
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
