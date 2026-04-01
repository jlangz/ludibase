import { parse } from 'node-html-parser'

export interface PsPlusGame {
  title: string
}

const PLATPRICES_BASE = 'https://platprices.com/psplus'

/**
 * Scrapes PlatPrices PS Plus catalog pages for Extra and Premium tiers.
 * PlatPrices maintains curated lists at /psplus/extra/ and /psplus/premium/.
 * Pages are paginated (~50 games per page).
 */
export async function fetchPsPlusCatalog(): Promise<{ extra: PsPlusGame[]; premium: PsPlusGame[] }> {
  const [extra, premium] = await Promise.all([
    fetchAllPages(`${PLATPRICES_BASE}/extra/`),
    fetchAllPages(`${PLATPRICES_BASE}/premium/`),
  ])

  console.log(`[PS Plus] Scraped ${extra.length} Extra games, ${premium.length} Premium games`)
  return { extra, premium }
}

async function fetchAllPages(baseUrl: string): Promise<PsPlusGame[]> {
  const allGames: PsPlusGame[] = []
  let page = 1

  while (true) {
    const url = `${baseUrl}?sort=alpha&page=${page}`
    const games = await fetchPage(url)

    if (games.length === 0) break
    allGames.push(...games)

    // Check if there's a next page — stop if we got fewer than expected
    // or reached a reasonable limit
    page++
    if (page > 30) break

    // Be polite — 500ms between pages
    await new Promise((r) => setTimeout(r, 500))
  }

  return deduplicateByTitle(allGames)
}

async function fetchPage(url: string): Promise<PsPlusGame[]> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })

  if (!res.ok) {
    console.warn(`[PS Plus] Page fetch failed: ${res.status} — ${url}`)
    return []
  }

  const html = await res.text()
  const root = parse(html)
  const games: PsPlusGame[] = []

  // PlatPrices uses <div class='game-name'>Title</div> inside game tiles
  const nameElements = root.querySelectorAll('.game-name')
  for (const el of nameElements) {
    const title = el.textContent?.trim()
    if (title && title.length > 1) {
      games.push({ title })
    }
  }

  return games
}

function deduplicateByTitle(games: PsPlusGame[]): PsPlusGame[] {
  const seen = new Set<string>()
  return games.filter((g) => {
    const key = g.title.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const PS_PLUS_EXTRA_SLUG = 'ps-plus-extra'
export const PS_PLUS_PREMIUM_SLUG = 'ps-plus-premium'
export const PS_PLUS_SOURCE = 'platprices-scrape'
