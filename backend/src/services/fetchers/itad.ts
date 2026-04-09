/**
 * IsThereAnyDeal (ITAD) API — used as fallback when native scrapers fail.
 *
 * Docs: https://docs.isthereanydeal.com/
 * Key endpoints:
 *   GET  /games/lookup/v1?key=...&title=...  — resolve title to ITAD game ID
 *   POST /games/subs/v1?key=...&country=...  — check subscriptions (body: JSON array of IDs)
 *
 * Rate limit: ~4 requests/second on free tier.
 */

const ITAD_BASE = 'https://api.isthereanydeal.com'

// Map ITAD subscription service names (as returned by the API) to our slug convention
const ITAD_SERVICE_MAP: Record<string, string[]> = {
  'game pass': ['gamepass-standard', 'gamepass-ultimate'],
  'pc game pass': ['gamepass-standard', 'gamepass-ultimate'],
  'ea play': ['ea-play'],
  'ea play pro': ['ea-play-pro'],
  'ubisoft+ classics': ['ubisoft-plus'],
  'ubisoft+ premium': ['ubisoft-plus-premium'],
}

export interface ItadGameSub {
  itadId: string
  title: string
  services: string[]  // Our service slugs
}

export class ItadService {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Look up ITAD game IDs by title.
   * Returns a map of input title -> ITAD game ID.
   * Uses GET /games/lookup/v1?title=... (one title per request).
   */
  async lookupGames(titles: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>()

    // Deduplicate
    const unique = [...new Set(titles)]

    // Process in parallel batches with rate limiting
    const concurrency = 4
    for (let i = 0; i < unique.length; i += concurrency) {
      const batch = unique.slice(i, i + concurrency)

      const lookups = await Promise.all(
        batch.map(async (title) => {
          const url = `${ITAD_BASE}/games/lookup/v1?key=${this.apiKey}&title=${encodeURIComponent(title)}`
          try {
            const res = await fetch(url)
            if (!res.ok) {
              if (res.status === 429) console.warn('[ITAD] Rate limited, slowing down')
              return null
            }
            const data = (await res.json()) as { found: boolean; game?: { id: string; title: string } }
            if (data.found && data.game) {
              return { inputTitle: title, itadId: data.game.id }
            }
          } catch {
            // skip
          }
          return null
        })
      )

      for (const result of lookups) {
        if (result) {
          results.set(result.inputTitle, result.itadId)
        }
      }

      if (i + concurrency < unique.length) {
        await sleep(260)
      }
    }

    return results
  }

  /**
   * Check which subscription services a set of ITAD game IDs are on.
   * Returns results mapped to our service slugs.
   */
  async getSubscriptions(itadIds: string[], country = 'US'): Promise<ItadGameSub[]> {
    const results: ItadGameSub[] = []

    const chunkSize = 50
    for (let i = 0; i < itadIds.length; i += chunkSize) {
      const chunk = itadIds.slice(i, i + chunkSize)

      const res = await fetch(`${ITAD_BASE}/games/subs/v1?key=${this.apiKey}&country=${country}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      })

      if (!res.ok) {
        console.warn(`[ITAD] Subs batch failed: ${res.status}`)
        continue
      }

      const data = (await res.json()) as Array<{ id: string; title?: string; subs?: Array<{ name: string }> }>
      for (const entry of data) {
        const services: string[] = []
        for (const sub of entry.subs ?? []) {
          const subName = sub.name?.toLowerCase()
          const mapped = subName ? ITAD_SERVICE_MAP[subName] : undefined
          if (mapped) {
            services.push(...mapped)
          }
        }

        if (services.length > 0) {
          results.push({
            itadId: entry.id,
            title: entry.title ?? '',
            services: [...new Set(services)],
          })
        }
      }

      if (i + chunkSize < itadIds.length) {
        await sleep(260)
      }
    }

    return results
  }
}

export const ITAD_SOURCE = 'itad'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
