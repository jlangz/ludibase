import { Hono } from 'hono'
import { eq, sql, and, isNull, inArray } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { games, gameSubscriptions } from '../db/schema.js'
import type { SubscriptionSyncer } from '../services/subscription-syncer.js'

export function subscriptionRoutes(db: Database, syncer: SubscriptionSyncer) {
  const app = new Hono()

  /**
   * GET /games/:igdbId/subscriptions
   * Returns all active subscription services for a game.
   */
  app.get('/games/:igdbId/subscriptions', async (c) => {
    const igdbId = parseInt(c.req.param('igdbId'), 10)
    if (isNaN(igdbId) || igdbId <= 0) {
      return c.json({ error: 'Invalid IGDB ID' }, 400)
    }

    const results = await db
      .select({
        serviceSlug: gameSubscriptions.serviceSlug,
        source: gameSubscriptions.source,
        addedAt: gameSubscriptions.addedAt,
      })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(and(eq(games.igdbId, igdbId), isNull(gameSubscriptions.removedAt)))

    return c.json({
      igdbId,
      subscriptions: results.map((r) => ({
        service: r.serviceSlug,
        source: r.source,
        addedAt: r.addedAt.toISOString(),
      })),
    })
  })

  /**
   * GET /subscriptions/service/:slug?page=1&pageSize=50
   * Returns all games currently on a specific subscription service.
   */
  app.get('/subscriptions/service/:slug', async (c) => {
    const slug = c.req.param('slug')
    const page = Math.max(parseInt(c.req.query('page') ?? '1', 10) || 1, 1)
    const pageSize = Math.min(parseInt(c.req.query('pageSize') ?? '50', 10) || 50, 100)
    const offset = (page - 1) * pageSize

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(gameSubscriptions)
      .where(and(eq(gameSubscriptions.serviceSlug, slug), isNull(gameSubscriptions.removedAt)))

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
      })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(and(eq(gameSubscriptions.serviceSlug, slug), isNull(gameSubscriptions.removedAt)))
      .orderBy(games.title)
      .limit(pageSize)
      .offset(offset)

    return c.json({
      service: slug,
      games: results.map((r) => ({
        ...r,
        firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
    })
  })

  /**
   * GET /subscriptions/check?igdbIds=1,2,3
   * Batch check: returns subscription info for multiple games at once.
   */
  app.get('/subscriptions/check', async (c) => {
    const idsParam = c.req.query('igdbIds')
    if (!idsParam) {
      return c.json({ error: 'Missing igdbIds parameter' }, 400)
    }

    const igdbIds = idsParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)

    if (igdbIds.length === 0) {
      return c.json({ error: 'No valid IGDB IDs provided' }, 400)
    }

    if (igdbIds.length > 100) {
      return c.json({ error: 'Maximum 100 IDs per request' }, 400)
    }

    const results = await db
      .select({
        igdbId: games.igdbId,
        serviceSlug: gameSubscriptions.serviceSlug,
      })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(
        and(
          inArray(games.igdbId, igdbIds),
          isNull(gameSubscriptions.removedAt),
        )
      )

    // Group by igdbId
    const grouped: Record<number, string[]> = {}
    for (const id of igdbIds) {
      grouped[id] = []
    }
    for (const row of results) {
      if (!grouped[row.igdbId]) grouped[row.igdbId] = []
      grouped[row.igdbId].push(row.serviceSlug)
    }

    return c.json(grouped)
  })

  /**
   * GET /subscriptions/stats
   * Returns game counts per subscription service.
   */
  app.get('/subscriptions/stats', async (c) => {
    const results = await db
      .select({
        serviceSlug: gameSubscriptions.serviceSlug,
        count: sql<number>`count(*)`,
      })
      .from(gameSubscriptions)
      .where(isNull(gameSubscriptions.removedAt))
      .groupBy(gameSubscriptions.serviceSlug)
      .orderBy(sql`count(*) DESC`)

    return c.json({
      services: results.map((r) => ({
        slug: r.serviceSlug,
        count: Number(r.count),
      })),
    })
  })

  /**
   * POST /subscriptions/sync?source=geforce-now
   * Manual sync trigger. Optional source parameter to run a single fetcher.
   */
  app.post('/subscriptions/sync', async (c) => {
    const source = c.req.query('source')

    // Run async — don't block the response
    const promise = source ? syncer.runOne(source) : syncer.runAll()
    promise.catch((err) => console.error('[Sync] Error:', err))

    return c.json({
      status: 'started',
      source: source ?? 'all',
      availableSources: syncer.registeredFetchers,
    })
  })

  return app
}
