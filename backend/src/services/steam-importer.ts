import { eq, sql } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { userGameCollection, steamConnections } from '../db/schema.js'
import type { SteamService } from './steam.js'
import { GameMatcher } from './game-matcher.js'

export interface SteamImportResult {
  total: number
  matched: number
  unmatched: number
  imported: number
}

export class SteamImporter {
  private matcher: GameMatcher

  constructor(
    private db: Database,
    private steam: SteamService,
  ) {
    this.matcher = new GameMatcher(db)
  }

  async importLibrary(userId: string, steamId: string): Promise<SteamImportResult> {
    // 1. Fetch owned games from Steam
    const steamGames = await this.steam.getOwnedGames(steamId)
    console.log(`[Steam] Fetched ${steamGames.length} games for ${steamId}`)

    if (steamGames.length === 0) {
      return { total: 0, matched: 0, unmatched: 0, imported: 0 }
    }

    // 2. Batch match titles against our games DB
    const titles = steamGames.map((g) => g.name)
    const matches = await this.matcher.matchTitlesBatch(titles)

    // 3. Build collection entries, deduplicating by gameId
    //    (multiple Steam entries can match the same game in our DB)
    const entryMap = new Map<number, {
      userId: string
      gameId: number
      source: string
      ownedPlatforms: string[]
      storefronts: string[]
      steamAppId: number
      steamPlaytimeMinutes: number
    }>()

    let matched = 0
    let unmatched = 0

    for (const sg of steamGames) {
      const match = matches.get(sg.name)
      if (match) {
        matched++
        const existing = entryMap.get(match.gameId)
        // Keep the entry with more playtime if duplicate
        if (!existing || sg.playtime_forever > existing.steamPlaytimeMinutes) {
          entryMap.set(match.gameId, {
            userId,
            gameId: match.gameId,
            source: 'steam',
            ownedPlatforms: ['PC'],
            storefronts: ['steam'],
            steamAppId: sg.appid,
            steamPlaytimeMinutes: sg.playtime_forever,
          })
        }
      } else {
        unmatched++
      }
    }

    const entries = [...entryMap.values()]

    // 4. Upsert into user_game_collection in batches
    const batchSize = 100
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)
      await this.db
        .insert(userGameCollection)
        .values(batch)
        .onConflictDoUpdate({
          target: [userGameCollection.userId, userGameCollection.gameId],
          set: {
            steamAppId: sql`EXCLUDED.steam_app_id`,
            steamPlaytimeMinutes: sql`EXCLUDED.steam_playtime_minutes`,
            source: sql`CASE WHEN ${userGameCollection.source} = 'manual' THEN 'manual' ELSE EXCLUDED.source END`,
            ownedPlatforms: sql`
              CASE
                WHEN ${userGameCollection.ownedPlatforms} IS NULL THEN EXCLUDED.owned_platforms
                WHEN NOT (${userGameCollection.ownedPlatforms} @> '"PC"'::jsonb) THEN ${userGameCollection.ownedPlatforms} || '"PC"'::jsonb
                ELSE ${userGameCollection.ownedPlatforms}
              END`,
            storefronts: sql`
              CASE
                WHEN ${userGameCollection.storefronts} IS NULL THEN EXCLUDED.storefronts
                WHEN NOT (${userGameCollection.storefronts} @> '"steam"'::jsonb) THEN ${userGameCollection.storefronts} || '"steam"'::jsonb
                ELSE ${userGameCollection.storefronts}
              END`,
            updatedAt: new Date(),
          },
        })
    }

    // 5. Update lastImportAt on steam_connections
    await this.db
      .update(steamConnections)
      .set({ lastImportAt: new Date() })
      .where(eq(steamConnections.userId, userId))

    console.log(`[Steam] Import complete: ${matched} matched, ${unmatched} unmatched, ${entries.length} imported`)
    return { total: steamGames.length, matched, unmatched, imported: entries.length }
  }
}
