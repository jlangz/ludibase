import { Hono } from 'hono'
import { eq, sql, and, inArray, isNull } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { games, userGameCollection, gameSubscriptions, profiles } from '../db/schema.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'

// Tier hierarchy — same as in games.ts
const SERVICE_TIER_INCLUDES: Record<string, string[]> = {
  'ps-plus-premium': ['ps-plus-extra', 'ps-plus-essential'],
  'ps-plus-extra': ['ps-plus-essential'],
  'gamepass-ultimate': ['gamepass-standard', 'gamepass-core'],
  'gamepass-standard': ['gamepass-core'],
  'ea-play-pro': ['ea-play'],
  'ubisoft-plus-premium': ['ubisoft-plus'],
  'nintendo-online-expansion': ['nintendo-online'],
}

function expandServiceTiers(services: string[]): string[] {
  const expanded = new Set(services)
  for (const slug of services) {
    const includes = SERVICE_TIER_INCLUDES[slug]
    if (includes) {
      for (const s of includes) expanded.add(s)
    }
  }
  return [...expanded]
}

/** Parse shared query params for search, sort, and platform filter. */
function parseListParams(c: { req: { query: (k: string) => string | undefined } }) {
  return {
    q: c.req.query('q')?.trim() ?? '',
    sort: c.req.query('sort') ?? 'alpha-asc',
    platform: c.req.query('platform') ?? '', // 'pc' | 'console' | ''
    page: Math.max(parseInt(c.req.query('page') ?? '1', 10) || 1, 1),
    pageSize: Math.min(parseInt(c.req.query('pageSize') ?? '20', 10) || 20, 100),
  }
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

export function collectionRoutes(db: Database, supabaseUrl: string) {
  const app = new Hono<AuthEnv>()

  app.use('/collection/*', requireAuth(supabaseUrl))
  app.use('/collection', requireAuth(supabaseUrl))

  /**
   * GET /collection?page=1&pageSize=20&storefront=steam&q=witcher&sort=alpha-asc&platform=pc
   * Returns the authenticated user's game collection.
   */
  app.get('/collection', async (c) => {
    const userId = c.get('userId')
    const { q, sort, platform, page, pageSize } = parseListParams(c)
    const storefront = c.req.query('storefront')
    const offset = (page - 1) * pageSize

    const conditions = [eq(userGameCollection.userId, userId)]
    if (storefront) {
      conditions.push(sql`${userGameCollection.storefronts} @> ${JSON.stringify([storefront])}::jsonb`)
    }
    const searchCond = buildSearchCondition(q)
    if (searchCond) conditions.push(searchCond)
    const platCond = buildPlatformCondition(platform)
    if (platCond) conditions.push(platCond)

    const where = conditions.length === 1 ? conditions[0] : and(...conditions)

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userGameCollection)
      .innerJoin(games, eq(games.id, userGameCollection.gameId))
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
      .orderBy(buildSortClause(sort))
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

  /**
   * GET /collection/subscriptions?service=gamepass-ultimate&page=1&pageSize=20&overlap=true
   * Returns games available through the user's subscription services.
   * - No service param: all games across all user subscriptions
   * - service param: games on that specific service (with tier expansion)
   * - overlap=true: only games that are also in the user's collection
   */
  app.get('/collection/subscriptions', async (c) => {
    const userId = c.get('userId')
    const serviceParam = c.req.query('service')
    const overlapOnly = c.req.query('overlap') === 'true'
    const { q, sort, platform, page, pageSize } = parseListParams(c)
    const offset = (page - 1) * pageSize

    // Get user's subscriptions from profile
    const [profile] = await db
      .select({ subscriptions: profiles.subscriptions })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)

    const userSubs = profile?.subscriptions ?? []
    if (userSubs.length === 0) {
      return c.json({ games: [], total: 0, page, pageSize, services: [] })
    }

    // Determine which services to query
    let serviceSlugs: string[]
    if (serviceParam) {
      serviceSlugs = expandServiceTiers([serviceParam])
    } else {
      serviceSlugs = expandServiceTiers(userSubs)
    }

    // Build conditions
    const conditions = [
      sql`${gameSubscriptions.serviceSlug} IN (${sql.join(serviceSlugs.map((s) => sql`${s}`), sql`, `)})`,
      isNull(gameSubscriptions.removedAt),
    ]

    if (overlapOnly) {
      conditions.push(sql`${games.id} IN (SELECT ${userGameCollection.gameId} FROM ${userGameCollection} WHERE ${userGameCollection.userId} = ${userId})`)
    }

    const searchCond = buildSearchCondition(q)
    if (searchCond) conditions.push(searchCond)
    const platCond = buildPlatformCondition(platform)
    if (platCond) conditions.push(platCond)

    const where = and(...conditions)

    // Count
    const [countResult] = await db
      .select({ count: sql<number>`count(DISTINCT ${games.id})` })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(where)

    const total = Number(countResult?.count ?? 0)

    // Fetch games
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
      .where(where)
      .groupBy(games.id)
      .orderBy(buildSortClause(sort))
      .limit(pageSize)
      .offset(offset)

    return c.json({
      games: results.map((r) => ({
        ...r,
        firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
      services: userSubs,
    })
  })

  /**
   * GET /collection/all?page=1&pageSize=20&q=witcher&sort=alpha-asc&platform=pc
   * Returns all games the user has access to: owned + subscription, deduplicated.
   */
  app.get('/collection/all', async (c) => {
    const userId = c.get('userId')
    const { q, sort, platform, page, pageSize } = parseListParams(c)
    const offset = (page - 1) * pageSize

    // Get user's subscriptions from profile
    const [profile] = await db
      .select({ subscriptions: profiles.subscriptions })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)

    const userSubs = profile?.subscriptions ?? []
    const expandedSubs = userSubs.length > 0 ? expandServiceTiers(userSubs) : []

    // Build a subquery for all game IDs the user has access to (owned UNION subscription)
    const ownedGameIds = sql`SELECT ${userGameCollection.gameId} FROM ${userGameCollection} WHERE ${userGameCollection.userId} = ${userId}`

    let allGameIds
    if (expandedSubs.length > 0) {
      const subGameIds = sql`SELECT ${gameSubscriptions.gameId} FROM ${gameSubscriptions} WHERE ${gameSubscriptions.removedAt} IS NULL AND ${gameSubscriptions.serviceSlug} IN (${sql.join(expandedSubs.map((s) => sql`${s}`), sql`, `)})`
      allGameIds = sql`(${ownedGameIds} UNION ${subGameIds})`
    } else {
      allGameIds = sql`(${ownedGameIds})`
    }

    // Build WHERE with search + platform filters
    const conditions = [sql`${games.id} IN ${allGameIds}`]
    const searchCond = buildSearchCondition(q)
    if (searchCond) conditions.push(searchCond)
    const platCond = buildPlatformCondition(platform)
    if (platCond) conditions.push(platCond)

    const where = and(...conditions)

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
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
      })
      .from(games)
      .where(where)
      .orderBy(buildSortClause(sort))
      .limit(pageSize)
      .offset(offset)

    return c.json({
      games: results.map((r) => ({
        ...r,
        firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
    })
  })

  return app
}
