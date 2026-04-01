import { parse } from 'node-html-parser'

export interface NintendoGame {
  title: string
  system?: string // NES, SNES, N64, Game Boy, etc.
}

const NSO_CLASSIC_GAMES_URL = 'https://www.nintendo.com/us/online/nintendo-switch-online/classic-games/'

export async function fetchNintendoCatalog(): Promise<NintendoGame[]> {
  const res = await fetch(NSO_CLASSIC_GAMES_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })

  if (!res.ok) {
    throw new Error(`Nintendo fetch failed: ${res.status} ${res.statusText}`)
  }

  const html = await res.text()
  const root = parse(html)
  const games: NintendoGame[] = []

  // Try common selectors for Nintendo's game listing
  const selectors = [
    '.game-title',
    '[class*="GameCard"] [class*="title"]',
    '[class*="game-list"] [class*="title"]',
    'h3[class*="game"]',
    '[data-testid="game-title"]',
    '.card-title',
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

  // Fallback: JSON-LD or embedded data
  if (games.length === 0) {
    const scripts = root.querySelectorAll('script')
    for (const script of scripts) {
      const text = script.textContent
      // Look for Next.js data or any embedded game list
      if (text.includes('"games"') || text.includes('"title"')) {
        const titleMatches = text.matchAll(/"(?:title|name|gameName)"\s*:\s*"([^"]{2,80})"/g)
        const seen = new Set<string>()
        for (const match of titleMatches) {
          const title = match[1].trim()
          if (!seen.has(title.toLowerCase())) {
            seen.add(title.toLowerCase())
            games.push({ title })
          }
        }
      }
    }
  }

  console.log(`[Nintendo] Scraped ${games.length} games`)
  return games
}

export const NINTENDO_ONLINE_SLUG = 'nintendo-online'
export const NINTENDO_EXPANSION_SLUG = 'nintendo-online-expansion'
export const NINTENDO_SOURCE = 'nintendo-scrape'
