import { Hono } from 'hono'
import { eq, sql, and, inArray } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { games, userGameCollection } from '../db/schema.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'

export function collectionRoutes(db: Database, supabaseUrl: string) {
  const app = new Hono<AuthEnv>()

  app.use('/collection/*', requireAuth(supabaseUrl))
  app.use('/collection', requireAuth(supabaseUrl))

  /**
   * GET /collection?page=1&pageSize=20&storefront=steam
   * Returns the authenticated user's game collection.
   * Optional storefront filter checks the storefronts jsonb array.
   */
  app.get('/collection', async (c) => {
    const userId = c.get('userId')
    const page = Math.max(parseInt(c.req.query('page') ?? '1', 10) || 1, 1)
    const pageSize = Math.min(parseInt(c.req.query('pageSize') ?? '20', 10) || 20, 100)
    const storefront = c.req.query('storefront')
    const offset = (page - 1) * pageSize

    const conditions = [eq(userGameCollection.userId, userId)]
    if (storefront) {
      conditions.push(sql`${userGameCollection.storefronts} @> ${JSON.stringify([storefront])}::jsonb`)
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions)

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userGameCollection)
      .where(where)

    const total = Number(countResult?.count ?? 0)

    const results = await db
      .select({
        igdbId: games.igdbId,
        title: games.title,
        slug: games.slug,
        coverImageId: games.coverImageId,
        platforms: games.platforms,
        genres: games.genres,
        developer: games.developer,
        publisher: games.publisher,
        aggregatedRating: games.aggregatedRating,
        firstReleaseDate: games.firstReleaseDate,
        source: userGameCollection.source,
        ownedPlatforms: userGameCollection.ownedPlatforms,
        storefronts: userGameCollection.storefronts,
        steamAppId: userGameCollection.steamAppId,
        steamPlaytimeMinutes: userGameCollection.steamPlaytimeMinutes,
        addedAt: userGameCollection.addedAt,
      })
      .from(userGameCollection)
      .innerJoin(games, eq(games.id, userGameCollection.gameId))
      .where(where)
      .orderBy(sql`${userGameCollection.addedAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    // Get distinct storefronts across entire collection (unfiltered)
    const sfRows = await db
      .select({ storefronts: userGameCollection.storefronts })
      .from(userGameCollection)
      .where(eq(userGameCollection.userId, userId))

    const allStorefronts = [...new Set(sfRows.flatMap((r) => r.storefronts ?? []))].sort()

    return c.json({
      games: results.map((r) => ({
        ...r,
        firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
        addedAt: r.addedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      storefronts: allStorefronts,
    })
  })

  /**
   * POST /collection/:igdbId
   * Add a game to the user's collection manually.
   */
  app.post('/collection/:igdbId', async (c) => {
    const userId = c.get('userId')
    const igdbId = parseInt(c.req.param('igdbId'), 10)

    if (isNaN(igdbId) || igdbId <= 0) {
      return c.json({ error: 'Invalid IGDB ID' }, 400)
    }

    const body = await c.req.json().catch(() => ({})) as { platforms?: string[]; storefronts?: string[] }
    const ownedPlatforms = Array.isArray(body.platforms) && body.platforms.length > 0
      ? body.platforms
      : null
    const storefronts = Array.isArray(body.storefronts) && body.storefronts.length > 0
      ? body.storefronts
      : null

    // Look up internal game ID
    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.igdbId, igdbId))
      .limit(1)

    if (!game) {
      return c.json({ error: 'Game not found' }, 404)
    }

    await db
      .insert(userGameCollection)
      .values({
        userId,
        gameId: game.id,
        source: 'manual',
        ownedPlatforms,
        storefronts,
      })
      .onConflictDoUpdate({
        target: [userGameCollection.userId, userGameCollection.gameId],
        set: {
          ownedPlatforms,
          storefronts,
          updatedAt: new Date(),
        },
      })

    return c.json({ success: true })
  })

  /**
   * DELETE /collection/:igdbId
   * Remove a game from the user's collection.
   */
  app.delete('/collection/:igdbId', async (c) => {
    const userId = c.get('userId')
    const igdbId = parseInt(c.req.param('igdbId'), 10)

    if (isNaN(igdbId) || igdbId <= 0) {
      return c.json({ error: 'Invalid IGDB ID' }, 400)
    }

    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.igdbId, igdbId))
      .limit(1)

    if (!game) {
      return c.json({ error: 'Game not found' }, 404)
    }

    await db
      .delete(userGameCollection)
      .where(
        and(
          eq(userGameCollection.userId, userId),
          eq(userGameCollection.gameId, game.id),
        )
      )

    return c.json({ success: true })
  })

  /**
   * GET /collection/check?igdbIds=1,2,3
   * Batch check which games are in the user's collection.
   * Returns entry details (platforms, storefronts) or null per game.
   */
  app.get('/collection/check', async (c) => {
    const userId = c.get('userId')
    const idsParam = c.req.query('igdbIds')
    if (!idsParam) return c.json({})

    const igdbIds = idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0)
    if (igdbIds.length === 0) return c.json({})

    const results = await db
      .select({
        igdbId: games.igdbId,
        ownedPlatforms: userGameCollection.ownedPlatforms,
        storefronts: userGameCollection.storefronts,
      })
      .from(userGameCollection)
      .innerJoin(games, eq(games.id, userGameCollection.gameId))
      .where(
        and(
          eq(userGameCollection.userId, userId),
          inArray(games.igdbId, igdbIds),
        )
      )

    const response: Record<number, { ownedPlatforms: string[] | null; storefronts: string[] | null } | null> = {}
    const resultMap = new Map(results.map((r) => [r.igdbId, r]))
    for (const id of igdbIds) {
      const entry = resultMap.get(id)
      response[id] = entry
        ? { ownedPlatforms: entry.ownedPlatforms, storefronts: entry.storefronts }
        : null
    }

    return c.json(response)
  })

  return app
}
