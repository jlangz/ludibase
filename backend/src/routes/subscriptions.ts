import { Hono } from 'hono'
import { eq, sql, and, isNull, inArray } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { games, gameSubscriptions } from '../db/schema.js'
import type { SubscriptionSyncer } from '../services/subscription-syncer.js'

const SERVICE_FAMILIES: Record<string, { name: string; tiers: string[] }> = {
  gamepass: { name: 'Xbox Game Pass', tiers: ['gamepass-core', 'gamepass-standard', 'gamepass-ultimate'] },
  'ps-plus': { name: 'PlayStation Plus', tiers: ['ps-plus-essential', 'ps-plus-extra', 'ps-plus-premium'] },
  'geforce-now': { name: 'GeForce NOW', tiers: ['geforce-now'] },
  'ea-play': { name: 'EA Play', tiers: ['ea-play'] },
  'ubisoft-plus': { name: 'Ubisoft+', tiers: ['ubisoft-plus', 'ubisoft-plus-premium'] },
  'nintendo-online': { name: 'Nintendo Switch Online', tiers: ['nintendo-online', 'nintendo-online-expansion'] },
}

function buildSortClause(sort: string) {
  switch (sort) {
    case 'alpha-desc': return sql`${games.title} DESC`
    case 'rating-desc': return sql`COALESCE(${games.aggregatedRating}, 0) DESC, ${games.title} ASC`
    case 'rating-asc': return sql`COALESCE(${games.aggregatedRating}, 0) ASC, ${games.title} ASC`
    case 'alpha-asc':
    default: return sql`${games.title} ASC`
  }
}

function buildSearchCondition(q: string) {
  if (q.length < 2) return null
  return sql`(${games.title} % ${q} OR ${games.title} ILIKE ${'%' + q + '%'})`
}

function buildPlatformCondition(platform: string) {
  if (platform === 'pc') return sql`${games.platforms} @> '"PC"'::jsonb`
  if (platform === 'console') return sql`(${games.platforms} @> '"Series X|S"'::jsonb OR ${games.platforms} @> '"XONE"'::jsonb)`
  return null
}

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

  /**
   * GET /subscriptions/family/:family?q=&sort=&platform=&tier=&page=&pageSize=
   * Returns all games across a service family's tiers, with per-game tier badges.
   */
  app.get('/subscriptions/family/:family', async (c) => {
    const familyKey = c.req.param('family')
    const family = SERVICE_FAMILIES[familyKey]
    if (!family) return c.json({ error: 'Unknown service family' }, 404)

    const q = c.req.query('q')?.trim() ?? ''
    const sort = c.req.query('sort') ?? 'alpha-asc'
    const platform = c.req.query('platform') ?? ''
    const tierFilter = c.req.query('tier') ?? ''
    const page = Math.max(parseInt(c.req.query('page') ?? '1', 10) || 1, 1)
    const pageSize = Math.min(parseInt(c.req.query('pageSize') ?? '30', 10) || 30, 100)
    const offset = (page - 1) * pageSize

    const targetTiers = tierFilter && family.tiers.includes(tierFilter)
      ? [tierFilter]
      : family.tiers

    const conditions = [
      sql`${gameSubscriptions.serviceSlug} IN (${sql.join(targetTiers.map((t) => sql`${t}`), sql`, `)})`,
      isNull(gameSubscriptions.removedAt),
    ]

    const searchCond = buildSearchCondition(q)
    if (searchCond) conditions.push(searchCond)
    const platCond = buildPlatformCondition(platform)
    if (platCond) conditions.push(platCond)

    const where = and(...conditions)

    // Count distinct games
    const [countResult] = await db
      .select({ count: sql<number>`count(DISTINCT ${games.id})` })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(where)

    const total = Number(countResult?.count ?? 0)

    // Fetch games with tier aggregation
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
        tiers: sql<string[]>`array_agg(DISTINCT ${gameSubscriptions.serviceSlug})`,
      })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(where)
      .groupBy(games.id)
      .orderBy(buildSortClause(sort))
      .limit(pageSize)
      .offset(offset)

    // Tier stats: total per tier + exclusive per tier
    // Respects platform filter so counts update when filtering by PC/Console
    const tierSlugs = family.tiers
    const tierConditions = [
      sql`${gameSubscriptions.serviceSlug} IN (${sql.join(tierSlugs.map((t) => sql`${t}`), sql`, `)})`,
      isNull(gameSubscriptions.removedAt),
    ]
    const tierPlatCond = buildPlatformCondition(platform)
    if (tierPlatCond) tierConditions.push(tierPlatCond)

    const tierCountRows = await db
      .select({
        serviceSlug: gameSubscriptions.serviceSlug,
        count: sql<number>`count(DISTINCT ${gameSubscriptions.gameId})`,
      })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(and(...tierConditions))
      .groupBy(gameSubscriptions.serviceSlug)

    const tierTotals: Record<string, number> = {}
    for (const tier of tierSlugs) tierTotals[tier] = 0
    for (const row of tierCountRows) tierTotals[row.serviceSlug] = Number(row.count)

    // Compute exclusive counts: for each tier, subtract the count of the next-lower tier
    // Tiers are ordered low→high in the family definition
    const tierExclusive: Record<string, number> = {}
    for (let i = 0; i < tierSlugs.length; i++) {
      const current = tierTotals[tierSlugs[i]]
      const lower = i > 0 ? tierTotals[tierSlugs[i - 1]] : 0
      tierExclusive[tierSlugs[i]] = current - lower
    }

    return c.json({
      family: familyKey,
      name: family.name,
      games: results.map((r) => ({
        ...r,
        firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
      tierCounts: tierTotals,
      tierExclusive,
    })
  })

  return app
}
