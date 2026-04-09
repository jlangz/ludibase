export interface XboxGame {
  title: string
  productId: string
}

// Sigl IDs for different Game Pass collections
// These are Microsoft's internal collection identifiers
const SIGLS = {
  // Game Pass PC catalog
  pc: 'fdd9e2a7-0fee-49f6-ad69-4354098401ff',
  // Game Pass Console catalog
  console: '29a81209-df6f-41fd-a528-2ae6b91f719c',
  // EA Play via Game Pass
  eaPlay: 'b8900d09-a491-44cc-916e-32b5acae621b',
} as const

const CATALOG_URL = 'https://catalog.gamepass.com/sigls/v2'
const DISPLAY_CATALOG_URL = 'https://displaycatalog.mp.microsoft.com/v7.0/products'

interface SiglEntry {
  id: string
}

interface DisplayProduct {
  ProductId: string
  LocalizedProperties?: Array<{
    ProductTitle?: string
  }>
}

interface DisplayCatalogResponse {
  Products?: DisplayProduct[]
}

async function fetchSiglProductIds(siglId: string, market = 'US', language = 'en-US'): Promise<string[]> {
  const url = `${CATALOG_URL}?id=${siglId}&market=${market}&language=${language}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Xbox sigls fetch failed (${siglId}): ${res.status} ${res.statusText}`)
  }

  const entries = (await res.json()) as SiglEntry[]

  // First entry is the collection metadata, rest are product IDs
  return entries
    .filter((e) => e.id && e.id !== siglId)
    .map((e) => e.id)
}

async function fetchProductDetails(productIds: string[], market = 'US', language = 'en-US'): Promise<XboxGame[]> {
  const games: XboxGame[] = []

  // displaycatalog accepts up to ~20 IDs per request
  const chunkSize = 20
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize)
    const bigIds = chunk.join(',')
    const url = `${DISPLAY_CATALOG_URL}?bigIds=${bigIds}&market=${market}&languages=${language}`

    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[Xbox] displaycatalog batch failed: ${res.status}`)
      continue
    }

    const data = (await res.json()) as DisplayCatalogResponse
    for (const product of data.Products ?? []) {
      const title = product.LocalizedProperties?.[0]?.ProductTitle
      if (title) {
        games.push({ title: title.trim(), productId: product.ProductId })
      }
    }

    // Small delay between batches
    if (i + chunkSize < productIds.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  return games
}

export async function fetchGamePassCatalog(): Promise<{ pc: XboxGame[]; console: XboxGame[]; eaPlay: XboxGame[] }> {
  // Fetch all three catalogs in parallel
  const [pcIds, consoleIds, eaPlayIds] = await Promise.all([
    fetchSiglProductIds(SIGLS.pc),
    fetchSiglProductIds(SIGLS.console),
    fetchSiglProductIds(SIGLS.eaPlay),
  ])

  console.log(`[Xbox] Found product IDs — PC: ${pcIds.length}, Console: ${consoleIds.length}, EA Play: ${eaPlayIds.length}`)

  // Fetch details for all unique product IDs
  const allIds = [...new Set([...pcIds, ...consoleIds, ...eaPlayIds])]
  const allGames = await fetchProductDetails(allIds)
  const gameMap = new Map(allGames.map((g) => [g.productId, g]))

  const resolve = (ids: string[]): XboxGame[] =>
    ids.map((id) => gameMap.get(id)).filter((g): g is XboxGame => g !== undefined)

  return {
    pc: resolve(pcIds),
    console: resolve(consoleIds),
    eaPlay: resolve(eaPlayIds),
  }
}

// Game Pass Standard = PC + Console combined
// Game Pass Ultimate = Standard + EA Play + cloud
// Game Pass Core = separate smaller catalog (Gold replacement), not tracked via sigls yet
export const XBOX_SOURCE = 'xbox-catalog'
