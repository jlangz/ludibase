import { Hono } from 'hono'
import { desc } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import type { GameImporter } from '../services/game-importer.js'
import { importRuns } from '../db/schema.js'

export function importRoutes(db: Database, importer: GameImporter) {
  const app = new Hono()

  /**
   * POST /import/bulk
   * Starts a bulk import. Runs async — returns the run ID immediately.
   */
  app.post('/import/bulk', (c) => {
    const resumeOffset = c.req.query('resume') ? parseInt(c.req.query('resume')!, 10) : undefined

    // Fire and forget — don't await
    importer.runBulkImport({ resumeFromOffset: resumeOffset }).catch((err) => {
      console.error('[Import route] Bulk import error:', err)
    })

    return c.json({ message: 'Bulk import started', resumeOffset: resumeOffset ?? null })
  })

  /**
   * POST /import/incremental
   * Starts an incremental import. Runs async — returns immediately.
   */
  app.post('/import/incremental', (c) => {
    importer.runIncrementalImport().catch((err) => {
      console.error('[Import route] Incremental import error:', err)
    })

    return c.json({ message: 'Incremental import started' })
  })

  /**
   * GET /import/status
   * Returns the latest import run info.
   */
  app.get('/import/status', async (c) => {
    const [latest] = await db
      .select()
      .from(importRuns)
      .orderBy(desc(importRuns.startedAt))
      .limit(1)

    if (!latest) {
      return c.json({ message: 'No imports have been run yet' }, 404)
    }

    return c.json(latest)
  })

  return app
}
