import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import type { Database } from '../db/index.js'

export function healthRoutes(db: Database) {
  const app = new Hono()

  app.get('/health', async (c) => {
    let status = 'ok'
    let dbStatus = 'ok'

    try {
      await db.execute(sql`SELECT 1`)
    } catch {
      status = 'degraded'
      dbStatus = 'error'
    }

    return c.json({ status, database: dbStatus })
  })

  return app
}
