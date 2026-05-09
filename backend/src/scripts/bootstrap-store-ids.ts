import { sql } from 'drizzle-orm'
import { loadConfig } from '../config'
import { createDb } from '../db/index'
import { gameStoreIds, gameSubscriptions, userGameCollection } from '../db/schema'

async function main() {
  const config = await loadConfig()
  const { db, client } = await createDb(config.databaseUrl)

  console.log('[Bootstrap] Populating game_store_ids from existing data...')

  let steamCount = 0
  let xboxCount = 0

  // 1. Steam app IDs from user_game_collection
  const steamFromCollection = await db
    .select({
      gameId: userGameCollection.gameId,
      steamAppId: userGameCollection.steamAppId,
    })
    .from(userGameCollection)
    .where(sql`${userGameCollection.steamAppId} IS NOT NULL`)

  for (const row of steamFromCollection) {
    await db
      .insert(gameStoreIds)
      .values({
        gameId: row.gameId,
        store: 'steam',
        storeId: String(row.steamAppId),
      })
      .onConflictDoNothing()
    steamCount++
  }
  console.log(`[Bootstrap] Steam from collection: ${steamCount}`)

  // 2. Steam app IDs from GeForce NOW external IDs (URLs like https://store.steampowered.com/app/1234)
  const gfnRows = await db
    .select({
      gameId: gameSubscriptions.gameId,
      externalId: gameSubscriptions.externalId,
    })
    .from(gameSubscriptions)
    .where(sql`${gameSubscriptions.source} = 'gfn-json' AND ${gameSubscriptions.externalId} LIKE '%store.steampowered.com/app/%'`)

  let gfnCount = 0
  for (const row of gfnRows) {
    const match = row.externalId?.match(/\/app\/(\d+)/)
    if (match) {
      await db
        .insert(gameStoreIds)
        .values({
          gameId: row.gameId,
          store: 'steam',
          storeId: match[1],
        })
        .onConflictDoNothing()
      gfnCount++
    }
  }
  console.log(`[Bootstrap] Steam from GFN: ${gfnCount}`)

  // 3. Xbox product IDs from subscription data
  const xboxRows = await db
    .select({
      gameId: gameSubscriptions.gameId,
      externalId: gameSubscriptions.externalId,
    })
    .from(gameSubscriptions)
    .where(sql`${gameSubscriptions.source} = 'xbox-catalog' AND ${gameSubscriptions.externalId} IS NOT NULL`)
    .groupBy(gameSubscriptions.gameId, gameSubscriptions.externalId)

  for (const row of xboxRows) {
    if (row.externalId) {
      await db
        .insert(gameStoreIds)
        .values({
          gameId: row.gameId,
          store: 'xbox',
          storeId: row.externalId,
        })
        .onConflictDoNothing()
      xboxCount++
    }
  }
  console.log(`[Bootstrap] Xbox from subs: ${xboxCount}`)

  // Summary
  const [total] = await db.select({ count: sql<number>`count(*)` }).from(gameStoreIds)
  console.log(`[Bootstrap] Total store IDs: ${Number(total?.count ?? 0)}`)

  await client.end()
}

main().catch((err) => {
  console.error('[Bootstrap] Unhandled error:', err)
  process.exit(1)
})
