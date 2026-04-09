import { Hono } from 'hono'
import { getNews } from '../services/news.js'

export function newsRoutes() {
  const app = new Hono()

  /**
   * GET /news?limit=20
   * Returns aggregated gaming news from RSS feeds.
   * Cached for 30 minutes.
   */
  app.get('/news', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10) || 20, 50)
    const items = await getNews(limit)
    return c.json({ items })
  })

  return app
}
