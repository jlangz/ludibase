import { parse } from 'node-html-parser'

export interface UbisoftGame {
  title: string
}

const UBISOFT_PLUS_URL = 'https://store.ubisoft.com/us/ubisoftplus/games?lang=en_US'

export async function fetchUbisoftPlusCatalog(): Promise<UbisoftGame[]> {
  const res = await fetch(UBISOFT_PLUS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })

  if (!res.ok) {
    throw new Error(`Ubisoft+ fetch failed: ${res.status} ${res.statusText}`)
  }

  const html = await res.text()
  const root = parse(html)
  const games: UbisoftGame[] = []

  // Try common selectors for Ubisoft's game listing
  const selectors = [
    '.game-title',
    '.product-tile__title',
    '[class*="productTile"] [class*="title"]',
    '[class*="GameCard"] h3',
    '.card__title',
    'h3[class*="name"]',
    '[data-testid="product-title"]',
  ]

  for (const selector of selectors) {
    const elements = root.querySelectorAll(selector)
    if (elements.length > 0) {
      for (const el of elements) {
        const title = el.textContent?.trim()
        if (title && title.length > 1) {
          games.push({ title })
        }
      }
      break
    }
  }

  // Fallback: JSON-LD
  if (games.length === 0) {
    const scripts = root.querySelectorAll('script[type="application/ld+json"]')
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent)
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.name) games.push({ title: item.name.trim() })
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // Fallback: embedded JSON data
  if (games.length === 0) {
    const scripts = root.querySelectorAll('script')
    for (const script of scripts) {
      const text = script.textContent
      if (text.includes('"products"') || text.includes('"games"')) {
        const titleMatches = text.matchAll(/"(?:title|name|displayName)"\s*:\s*"([^"]{2,80})"/g)
        for (const match of titleMatches) {
          games.push({ title: match[1].trim() })
        }
      }
    }
  }

  console.log(`[Ubisoft+] Scraped ${games.length} games`)
  return deduplicateByTitle(games)
}

function deduplicateByTitle(games: UbisoftGame[]): UbisoftGame[] {
  const seen = new Set<string>()
  return games.filter((g) => {
    const key = g.title.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const UBISOFT_PLUS_SLUG = 'ubisoft-plus'
export const UBISOFT_PLUS_PREMIUM_SLUG = 'ubisoft-plus-premium'
export const UBISOFT_SOURCE = 'ubisoft-scrape'
