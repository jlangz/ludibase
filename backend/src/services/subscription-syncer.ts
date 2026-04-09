import { eq, and, isNull, inArray } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { gameSubscriptions, subscriptionSyncRuns } from '../db/schema.js'
import { GameMatcher } from './game-matcher.js'

export interface FetchedGame {
  title: string
  externalId?: string
}

export interface FetcherResult {
  serviceSlug: string
  source: string
  games: FetchedGame[]
}

export interface SyncStats {
  source: string
  checked: number
  added: number
  removed: number
  unchanged: number
  unmatched: number
}

type Fetcher = () => Promise<FetcherResult[]>

export class SubscriptionSyncer {
  private fetchers = new Map<string, Fetcher>()
  private matcher: GameMatcher

  constructor(private db: Database) {
    this.matcher = new GameMatcher(db)
  }

  registerFetcher(name: string, fetcher: Fetcher) {
    this.fetchers.set(name, fetcher)
  }

  async runAll(): Promise<SyncStats[]> {
    const allStats: SyncStats[] = []

    for (const [name, fetcher] of this.fetchers) {
      try {
        console.log(`[Sync] Running fetcher: ${name}`)
        const results = await fetcher()
        for (const result of results) {
          const stats = await this.syncService(result)
          allStats.push(stats)
          console.log(`[Sync] ${result.serviceSlug}: +${stats.added} -${stats.removed} =${stats.unchanged} (${stats.unmatched} unmatched)`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[Sync] Fetcher ${name} failed: ${message}`)
        await this.recordRun(name, 'failed', { checked: 0, added: 0, removed: 0, unchanged: 0, unmatched: 0, source: name }, message)
      }
    }

    return allStats
  }

  async runOne(name: string): Promise<SyncStats[]> {
    const fetcher = this.fetchers.get(name)
    if (!fetcher) {
      throw new Error(`Unknown fetcher: ${name}. Available: ${[...this.fetchers.keys()].join(', ')}`)
    }

    console.log(`[Sync] Running fetcher: ${name}`)
    const results = await fetcher()
    const allStats: SyncStats[] = []

    for (const result of results) {
      const stats = await this.syncService(result)
      allStats.push(stats)
      console.log(`[Sync] ${result.serviceSlug}: +${stats.added} -${stats.removed} =${stats.unchanged} (${stats.unmatched} unmatched)`)
    }

    return allStats
  }

  private async syncService(result: FetcherResult): Promise<SyncStats> {
    const stats: SyncStats = {
      source: result.source,
      checked: result.games.length,
      added: 0,
      removed: 0,
      unchanged: 0,
      unmatched: 0,
    }

    try {
      // Match fetched titles to our games table
      const titles = result.games.map((g) => g.title)
      const matches = await this.matcher.matchTitlesBatch(titles)

      // Build a map of externalId -> match for fetched games
      const matchedGameIds = new Map<number, FetchedGame>()
      for (const game of result.games) {
        const match = matches.get(game.title)
        if (match) {
          matchedGameIds.set(match.gameId, game)
        } else {
          stats.unmatched++
        }
      }

      // Get current active subscriptions for this service
      const currentSubs = await this.db
        .select({
          id: gameSubscriptions.id,
          gameId: gameSubscriptions.gameId,
        })
        .from(gameSubscriptions)
        .where(
          and(
            eq(gameSubscriptions.serviceSlug, result.serviceSlug),
            isNull(gameSubscriptions.removedAt),
          )
        )

      const currentGameIds = new Set(currentSubs.map((s) => s.gameId))
      const fetchedGameIds = new Set(matchedGameIds.keys())

      // Games to add (in fetched but not in current)
      const toAdd: { gameId: number; externalId?: string }[] = []
      for (const [gameId, game] of matchedGameIds) {
        if (!currentGameIds.has(gameId)) {
          toAdd.push({ gameId, externalId: game.externalId })
        } else {
          stats.unchanged++
        }
      }

      // Games to remove (in current but not in fetched)
      const toRemove = currentSubs.filter((s) => !fetchedGameIds.has(s.gameId))

      // Insert new subscriptions
      if (toAdd.length > 0) {
        await this.db.insert(gameSubscriptions).values(
          toAdd.map((g) => ({
            gameId: g.gameId,
            serviceSlug: result.serviceSlug,
            source: result.source,
            externalId: g.externalId ?? null,
          }))
        )
        stats.added = toAdd.length
      }

      // Mark removed subscriptions
      if (toRemove.length > 0) {
        const removeIds = toRemove.map((s) => s.id)
        await this.db
          .update(gameSubscriptions)
          .set({ removedAt: new Date() })
          .where(inArray(gameSubscriptions.id, removeIds))
        stats.removed = toRemove.length
      }

      // Update lastCheckedAt for unchanged entries
      if (stats.unchanged > 0) {
        const unchangedIds = currentSubs
          .filter((s) => fetchedGameIds.has(s.gameId))
          .map((s) => s.id)
        if (unchangedIds.length > 0) {
          await this.db
            .update(gameSubscriptions)
            .set({ lastCheckedAt: new Date() })
            .where(inArray(gameSubscriptions.id, unchangedIds))
        }
      }

      await this.recordRun(result.source, 'completed', stats)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.recordRun(result.source, 'failed', stats, message)
      throw err
    }

    return stats
  }

  private async recordRun(source: string, status: string, stats: SyncStats, errorMessage?: string) {
    await this.db.insert(subscriptionSyncRuns).values({
      source,
      status,
      totalChecked: stats.checked,
      totalAdded: stats.added,
      totalRemoved: stats.removed,
      totalUnchanged: stats.unchanged,
      errorMessage: errorMessage ?? null,
      completedAt: status !== 'running' ? new Date() : null,
    })
  }

  get registeredFetchers(): string[] {
    return [...this.fetchers.keys()]
  }
}
