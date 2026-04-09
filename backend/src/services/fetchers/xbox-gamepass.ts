export interface XboxGame {
  title: string
  productId: string
  /** Which Game Pass platforms this game is available on */
  xboxPlatforms: ('pc' | 'console')[]
}

// Sigl IDs for different Game Pass collections
const SIGLS = {
  core: '34031711-5a70-4196-bab7-45757dc2294e',
  pc: 'fdd9e2a7-0fee-49f6-ad69-4354098401ff',
  console: '29a81209-df6f-41fd-a528-2ae6b91f719c',
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

  return entries
    .filter((e) => e.id && e.id !== siglId)
    .map((e) => e.id)
}

async function fetchProductDetails(productIds: string[], market = 'US', language = 'en-US'): Promise<Map<string, string>> {
  const titleMap = new Map<string, string>() // productId -> title

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
        titleMap.set(product.ProductId, title.trim())
      }
    }

    if (i + chunkSize < productIds.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  return titleMap
}

export interface GamePassCatalog {
  core: XboxGame[]
  standard: XboxGame[]
  ultimate: XboxGame[]
  eaPlay: XboxGame[]
  /** Raw sigl membership for debugging/analysis */
  raw: {
    coreIds: Set<string>
    pcIds: Set<string>
    consoleIds: Set<string>
    eaPlayIds: Set<string>
  }
}

export async function fetchGamePassCatalog(): Promise<GamePassCatalog> {
  // Fetch all four sigls in parallel
  const [coreIdList, pcIdList, consoleIdList, eaPlayIdList] = await Promise.all([
    fetchSiglProductIds(SIGLS.core),
    fetchSiglProductIds(SIGLS.pc),
    fetchSiglProductIds(SIGLS.console),
    fetchSiglProductIds(SIGLS.eaPlay),
  ])

  const coreIds = new Set(coreIdList)
  const pcIds = new Set(pcIdList)
  const consoleIds = new Set(consoleIdList)
  const eaPlayIds = new Set(eaPlayIdList)

  console.log(`[Xbox] Found product IDs — Core: ${coreIds.size}, PC: ${pcIds.size}, Console: ${consoleIds.size}, EA Play: ${eaPlayIds.size}`)

  // Fetch titles for all unique product IDs
  const allIds = [...new Set([...coreIds, ...pcIds, ...consoleIds, ...eaPlayIds])]
  const titleMap = await fetchProductDetails(allIds)

  // Helper: build XboxGame with platform info derived from sigl membership
  function buildGame(productId: string): XboxGame | null {
    const title = titleMap.get(productId)
    if (!title) return null
    const platforms: ('pc' | 'console')[] = []
    if (pcIds.has(productId)) platforms.push('pc')
    if (consoleIds.has(productId)) platforms.push('console')
    // Core and EA Play games: derive from PC/Console membership, fallback to both
    if (platforms.length === 0) {
      // Not in PC or Console sigl — check if it might be console-only (Core games)
      platforms.push('console')
    }
    return { title, productId, xboxPlatforms: platforms }
  }

  // Core: its own sigl
  const core = [...coreIds].map(buildGame).filter((g): g is XboxGame => g !== null)

  // Standard: PC + Console combined
  const standardIds = new Set([...pcIds, ...consoleIds])
  const standard = [...standardIds].map(buildGame).filter((g): g is XboxGame => g !== null)

  // Ultimate: Standard + EA Play
  const ultimateIds = new Set([...standardIds, ...eaPlayIds])
  const ultimate = [...ultimateIds].map(buildGame).filter((g): g is XboxGame => g !== null)

  // EA Play: its own sigl (for separate ea-play service tracking)
  const eaPlay = [...eaPlayIds].map(buildGame).filter((g): g is XboxGame => g !== null)

  return {
    core,
    standard,
    ultimate,
    eaPlay,
    raw: { coreIds, pcIds, consoleIds, eaPlayIds },
  }
}

export const XBOX_SOURCE = 'xbox-catalog'
