import { sql } from 'drizzle-orm'
import type { Database } from '../db/index'
import { games } from '../db/schema'

export interface MatchResult {
  gameId: number
  igdbId: number
  title: string
  confidence: number
}

export class GameMatcher {
  constructor(private db: Database) {}

  async matchTitle(title: string): Promise<MatchResult | null> {
    // Use % operator (triggers GIN trigram index) for fast filtering,
    // then rank by similarity() for best match
    const results = await this.db
      .select({
        id: games.id,
        igdbId: games.igdbId,
        title: games.title,
        similarity: sql<number>`similarity(${games.title}, ${title})`,
      })
      .from(games)
      .where(sql`${games.title} % ${title}`)
      .orderBy(sql`similarity(${games.title}, ${title}) DESC`)
      .limit(1)

    if (results.length === 0) return null

    const row = results[0]
    return {
      gameId: row.id,
      igdbId: row.igdbId,
      title: row.title,
      confidence: row.similarity,
    }
  }

  async matchTitlesBatch(titles: string[]): Promise<Map<string, MatchResult>> {
    if (titles.length === 0) return new Map()

    // Deduplicate input titles
    const unique = [...new Set(titles)]
    const results = new Map<string, MatchResult>()

    // Run individual queries in parallel batches — each query uses
    // the GIN trigram index so it's fast (~5-10ms per title)
    const concurrency = 20
    for (let i = 0; i < unique.length; i += concurrency) {
      const batch = unique.slice(i, i + concurrency)
      const matches = await Promise.all(batch.map((t) => this.matchTitle(t)))
      for (let j = 0; j < batch.length; j++) {
        const match = matches[j]
        if (match) {
          results.set(batch[j], match)
        }
      }
    }

    return results
  }
}
