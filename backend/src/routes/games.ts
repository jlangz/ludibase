import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import type { IgdbService } from '../services/igdb.js'
import { games } from '../db/schema.js'

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
