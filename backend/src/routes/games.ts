import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import type { IgdbService } from '../services/igdb.js'
import { games } from '../db/schema.js'

export function gamesRoutes(db: Database, igdb: IgdbService) {
  const app = new Hono()

  /**
   * GET /games/search?q=witcher
   * Searches IGDB live — does NOT cache results.
   * Returns an array of GameSearchResult objects.
   */
  app.get('/games/search', async (c) => {
    const query = c.req.query('q')

    if (!query || query.trim().length === 0) {
      return c.json({ error: 'Missing search query parameter "q"' }, 400)
    }

    if (query.length > 200) {
      return c.json({ error: 'Search query too long' }, 400)
    }

    const results = await igdb.searchGames(query.trim())
    return c.json(results)
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
        summary: cached.summary,
        coverImageId: cached.coverImageId,
        platforms: cached.platforms,
        genres: cached.genres,
        firstReleaseDate: cached.firstReleaseDate?.toISOString() ?? null,
        igdbUrl: cached.igdbUrl,
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
      summary: game.summary,
      coverImageId: game.coverImageId,
      firstReleaseDate: game.firstReleaseDate ? new Date(game.firstReleaseDate) : null,
      platforms: game.platforms,
      genres: game.genres,
      igdbUrl: game.igdbUrl,
    }).onConflictDoNothing()

    return c.json({ ...game, cached: false })
  })

  return app
}
