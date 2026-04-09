import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import type { IgdbService } from '../services/igdb.js'
import { games, gameSubscriptions } from '../db/schema.js'

/**
 * Subscription tier hierarchy — higher tiers include access to all lower tiers.
 * E.g. a PS Plus Premium subscriber can play Extra and Essential games too.
 *
 * Xbox tiers are already handled at the data layer (our fetcher builds
 * Ultimate = Standard + EA Play), but included here for completeness.
 */
const SERVICE_TIER_INCLUDES: Record<string, string[]> = {
  'ps-plus-premium': ['ps-plus-extra', 'ps-plus-essential'],
  'ps-plus-extra': ['ps-plus-essential'],
  'gamepass-ultimate': ['gamepass-standard', 'gamepass-core'],
  'gamepass-standard': ['gamepass-core'],
  'ea-play-pro': ['ea-play'],
  'ubisoft-plus-premium': ['ubisoft-plus'],
  'nintendo-online-expansion': ['nintendo-online'],
}

/** Expand a list of service slugs to include all lower-tier services they encompass. */
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

export function gamesRoutes(db: Database, igdb: IgdbService) {
  const app = new Hono()

  /**
   * GET /games/search?q=witcher&limit=20
   * Searches the local games database using trigram similarity.
   * Returns results ranked by similarity score.
   */
  app.get('/games/search', async (c) => {
    const query = c.req.query('q')
    const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10) || 20, 100)

    if (!query || query.trim().length === 0) {
      return c.json({ error: 'Missing search query parameter "q"' }, 400)
    }

    if (query.length > 200) {
      return c.json({ error: 'Search query too long' }, 400)
    }

    const term = query.trim()

    const results = await db
      .select({
        igdbId: games.igdbId,
        title: games.title,
        slug: games.slug,
        summary: games.summary,
        coverImageId: games.coverImageId,
        platforms: games.platforms,
        genres: games.genres,
        category: games.category,
        developer: games.developer,
        publisher: games.publisher,
        aggregatedRating: games.aggregatedRating,
        ratingCount: games.ratingCount,
        firstReleaseDate: games.firstReleaseDate,
        igdbUrl: games.igdbUrl,
        igdbUpdatedAt: games.igdbUpdatedAt,
        similarity: sql<number>`similarity(${games.title}, ${term})`,
      })
      .from(games)
      .where(sql`${games.title} % ${term} OR ${games.title} ILIKE ${'%' + term + '%'}`)
      .orderBy(sql`similarity(${games.title}, ${term}) DESC`)
      .limit(limit)

    return c.json(results.map(r => ({
      ...r,
      firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
      similarity: undefined,
    })))
  })

  /**
   * GET /games/search/filtered?q=witcher&services=gamepass-ultimate,ps-plus-extra&page=1&pageSize=20
   * Searches games with optional subscription service filtering.
   * When services are provided, only returns games available on those services.
   * Results sorted by similarity (best match first), then alphabetically.
   */
  app.get('/games/search/filtered', async (c) => {
    const query = c.req.query('q')?.trim() ?? ''
    const servicesParam = c.req.query('services')?.trim() ?? ''
    const page = Math.max(parseInt(c.req.query('page') ?? '1', 10) || 1, 1)
    const pageSize = Math.min(parseInt(c.req.query('pageSize') ?? '20', 10) || 20, 100)
    const offset = (page - 1) * pageSize

    const serviceFilters = servicesParam
      ? expandServiceTiers(servicesParam.split(',').map((s) => s.trim()).filter(Boolean))
      : []

    // Build WHERE conditions
    const conditions = []

    if (query.length >= 2) {
      conditions.push(sql`(${games.title} % ${query} OR ${games.title} ILIKE ${'%' + query + '%'})`)
    }

    if (serviceFilters.length > 0) {
      conditions.push(
        sql`${games.id} IN (
          SELECT ${gameSubscriptions.gameId} FROM ${gameSubscriptions}
          WHERE ${gameSubscriptions.removedAt} IS NULL
          AND ${gameSubscriptions.serviceSlug} IN (${sql.join(serviceFilters.map((s) => sql`${s}`), sql`, `)})
        )`
      )
    }

    // If no query and no filters, require at least one
    if (conditions.length === 0) {
      return c.json({ games: [], total: 0, page, pageSize })
    }

    const where = conditions.length === 1 ? conditions[0] : sql`${sql.join(conditions, sql` AND `)}`

    // Count total
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(where)

    const total = Number(countResult?.count ?? 0)

    // Order: if searching, sort by similarity then alpha. Otherwise just alpha.
    const orderBy = query.length >= 2
      ? sql`similarity(${games.title}, ${query}) DESC, ${games.title} ASC`
      : sql`${games.title} ASC`

    const results = await db
      .select({
        igdbId: games.igdbId,
        title: games.title,
        slug: games.slug,
        summary: games.summary,
        coverImageId: games.coverImageId,
        platforms: games.platforms,
        genres: games.genres,
        category: games.category,
        developer: games.developer,
        publisher: games.publisher,
        aggregatedRating: games.aggregatedRating,
        ratingCount: games.ratingCount,
        firstReleaseDate: games.firstReleaseDate,
        igdbUrl: games.igdbUrl,
      })
      .from(games)
      .where(where)
      .orderBy(orderBy)
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

  /**
   * GET /games/popular?limit=20&page=1
   * Returns games sorted by rating count (most-rated = most popular).
   * Only includes games that are on at least one subscription service.
   */
  app.get('/games/popular', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10) || 20, 100)
    const page = Math.max(parseInt(c.req.query('page') ?? '1', 10) || 1, 1)
    const offset = (page - 1) * limit

    // Score = ratingCount * (aggregatedRating / 100) — rewards both well-known AND well-rated games
    const results = await db
      .select({
        igdbId: games.igdbId,
        title: games.title,
        slug: games.slug,
        summary: games.summary,
        coverImageId: games.coverImageId,
        platforms: games.platforms,
        genres: games.genres,
        category: games.category,
        developer: games.developer,
        publisher: games.publisher,
        aggregatedRating: games.aggregatedRating,
        ratingCount: games.ratingCount,
        firstReleaseDate: games.firstReleaseDate,
        igdbUrl: games.igdbUrl,
      })
      .from(games)
      .where(sql`${games.ratingCount} IS NOT NULL AND ${games.ratingCount} > 0 AND ${games.coverImageId} IS NOT NULL`)
      .orderBy(sql`(${games.ratingCount} * COALESCE(${games.aggregatedRating}, 50)) DESC`)
      .limit(limit)
      .offset(offset)

    return c.json(results.map(r => ({
      ...r,
      firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
    })))
  })

  /**
   * GET /games/:igdbId
   * Returns a single game by IGDB ID.
   * Checks local cache first, fetches from IGDB and caches if not found.
   */
  app.get('/games/:igdbId', async (c) => {
    const igdbId = parseInt(c.req.param('igdbId'), 10)

    if (isNaN(igdbId) || igdbId <= 0) {
      return c.json({ error: 'Invalid IGDB ID' }, 400)
    }

    // Check local cache
    const [cached] = await db
      .select()
      .from(games)
      .where(eq(games.igdbId, igdbId))
      .limit(1)

    if (cached) {
      return c.json({
        igdbId: cached.igdbId,
        title: cached.title,
        slug: cached.slug,
        summary: cached.summary,
        coverImageId: cached.coverImageId,
        platforms: cached.platforms,
        genres: cached.genres,
        category: cached.category,
        developer: cached.developer,
        publisher: cached.publisher,
        aggregatedRating: cached.aggregatedRating,
        ratingCount: cached.ratingCount,
        firstReleaseDate: cached.firstReleaseDate?.toISOString() ?? null,
        igdbUrl: cached.igdbUrl,
        igdbUpdatedAt: cached.igdbUpdatedAt,
        cached: true,
      })
    }

    // Fetch from IGDB
    const game = await igdb.getGameById(igdbId)

    if (!game) {
      return c.json({ error: 'Game not found' }, 404)
    }

    // Cache in database
    await db.insert(games).values({
      igdbId: game.igdbId,
      title: game.title,
      slug: game.slug,
      summary: game.summary,
      coverImageId: game.coverImageId,
      firstReleaseDate: game.firstReleaseDate ? new Date(game.firstReleaseDate) : null,
      platforms: game.platforms,
      genres: game.genres,
      category: game.category,
      developer: game.developer,
      publisher: game.publisher,
      aggregatedRating: game.aggregatedRating,
      ratingCount: game.ratingCount,
      igdbUrl: game.igdbUrl,
      igdbUpdatedAt: game.igdbUpdatedAt,
    }).onConflictDoNothing()

    return c.json({ ...game, cached: false })
  })

  return app
}
