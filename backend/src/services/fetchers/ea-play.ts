import { parse } from 'node-html-parser'

export interface EaGame {
  title: string
}

const EA_PLAY_URL = 'https://www.ea.com/ea-play/games'

export async function fetchEaPlayCatalog(): Promise<EaGame[]> {
  const res = await fetch(EA_PLAY_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })

  if (!res.ok) {
    throw new Error(`EA Play fetch failed: ${res.status} ${res.statusText}`)
  }

  const html = await res.text()
  const root = parse(html)
  const games: EaGame[] = []

  // EA's game list page uses various selectors — try common patterns
  // Look for game title elements in card/list structures
  const selectors = [
    '[data-testid="game-title"]',
    '.ea-game-title',
    'h3.title',
    '.card-title',
    '[class*="GameCard"] h3',
    '[class*="gameCard"] [class*="title"]',
    'a[href*="/games/"] h2',
    'a[href*="/games/"] h3',
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

  // Fallback: look for JSON-LD structured data
  if (games.length === 0) {
    const scripts = root.querySelectorAll('script[type="application/ld+json"]')
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent)
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.name) games.push({ title: item.name.trim() })
          }
        } else if (data.itemListElement) {
          for (const item of data.itemListElement) {
            if (item.name) games.push({ title: item.name.trim() })
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  // Fallback: look for Next.js or React hydration data
  if (games.length === 0) {
    const scripts = root.querySelectorAll('script')
    for (const script of scripts) {
      const text = script.textContent
      if (text.includes('__NEXT_DATA__') || text.includes('__initialData')) {
        // Try to extract game names from embedded JSON
        const titleMatches = text.matchAll(/"(?:title|name|gameName)"\s*:\s*"([^"]{2,80})"/g)
        for (const match of titleMatches) {
          games.push({ title: match[1].trim() })
        }
      }
    }
  }

  console.log(`[EA Play] Scraped ${games.length} games`)
  return deduplicateByTitle(games)
}

function deduplicateByTitle(games: EaGame[]): EaGame[] {
  const seen = new Set<string>()
  return games.filter((g) => {
    const key = g.title.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const EA_PLAY_SLUG = 'ea-play'
export const EA_PLAY_PRO_SLUG = 'ea-play-pro'
export const EA_PLAY_SOURCE = 'ea-scrape'
