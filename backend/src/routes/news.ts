import { Hono } from 'hono'
import { eq, sql, and, inArray } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { savedArticles } from '../db/schema.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import { getNews } from '../services/news.js'

export function newsRoutes(db: Database, supabaseUrl?: string) {
  const app = new Hono<AuthEnv>()

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

  // Authenticated endpoints for saved articles
  if (supabaseUrl) {
    /**
     * POST /news/save
     * Save an article for later.
     */
    app.post('/news/save', requireAuth(supabaseUrl), async (c) => {
      const userId = c.get('userId')
      const body = (await c.req.json()) as {
        url: string
        title: string
        description?: string
        imageUrl?: string
        source: string
        pubDate?: string
      }

      if (!body.url || !body.title || !body.source) {
        return c.json({ error: 'url, title, and source are required' }, 400)
      }

      await db
        .insert(savedArticles)
        .values({
          userId,
          articleUrl: body.url,
          title: body.title,
          description: body.description ?? null,
          imageUrl: body.imageUrl ?? null,
          source: body.source,
          pubDate: body.pubDate ? new Date(body.pubDate) : null,
        })
        .onConflictDoNothing()

      return c.json({ success: true })
    })

    /**
     * DELETE /news/save
     * Remove a saved article.
     */
    app.delete('/news/save', requireAuth(supabaseUrl), async (c) => {
      const userId = c.get('userId')
      const body = (await c.req.json()) as { url: string }

      if (!body.url) {
        return c.json({ error: 'url is required' }, 400)
      }

      await db
        .delete(savedArticles)
        .where(and(
          eq(savedArticles.userId, userId),
          eq(savedArticles.articleUrl, body.url),
        ))

      return c.json({ success: true })
    })

    /**
     * GET /news/saved?page=1&pageSize=20
     * Get the user's saved articles.
     */
    app.get('/news/saved', requireAuth(supabaseUrl), async (c) => {
      const userId = c.get('userId')
      const page = Math.max(parseInt(c.req.query('page') ?? '1', 10) || 1, 1)
      const pageSize = Math.min(parseInt(c.req.query('pageSize') ?? '20', 10) || 20, 50)
      const offset = (page - 1) * pageSize

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(savedArticles)
        .where(eq(savedArticles.userId, userId))

      const total = Number(countResult?.count ?? 0)

      const results = await db
        .select()
        .from(savedArticles)
        .where(eq(savedArticles.userId, userId))
        .orderBy(sql`${savedArticles.savedAt} DESC`)
        .limit(pageSize)
        .offset(offset)

      return c.json({
        articles: results.map((r) => ({
          url: r.articleUrl,
          title: r.title,
          description: r.description,
          imageUrl: r.imageUrl,
          source: r.source,
          pubDate: r.pubDate?.toISOString() ?? null,
          savedAt: r.savedAt.toISOString(),
        })),
        total,
        page,
        pageSize,
      })
    })

    /**
     * GET /news/saved/check?urls=url1,url2
     * Batch check which articles are saved.
     */
    app.get('/news/saved/check', requireAuth(supabaseUrl), async (c) => {
      const userId = c.get('userId')
      const urlsParam = c.req.query('urls')
      if (!urlsParam) return c.json({})

      const urls = urlsParam.split(',').map((u) => decodeURIComponent(u.trim())).filter(Boolean)
      if (urls.length === 0) return c.json({})

      const results = await db
        .select({ articleUrl: savedArticles.articleUrl })
        .from(savedArticles)
        .where(and(
          eq(savedArticles.userId, userId),
          inArray(savedArticles.articleUrl, urls),
        ))

      const saved = new Set(results.map((r) => r.articleUrl))
      const response: Record<string, boolean> = {}
      for (const url of urls) {
        response[url] = saved.has(url)
      }

      return c.json(response)
    })
  }

  return app
}
