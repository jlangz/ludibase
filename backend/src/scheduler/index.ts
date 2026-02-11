import cron from 'node-cron'
import type { GameImporter } from '../services/game-importer.js'

export function startScheduler(importer: GameImporter) {
  // Daily incremental game import at 4:00 AM UTC
  cron.schedule('0 4 * * *', async () => {
    console.log('[Cron] Starting daily incremental game import...')
    try {
      const result = await importer.runIncrementalImport()
      console.log(`[Cron] Import complete: ${result.inserted} new, ${result.updated} updated`)
    } catch (err) {
      console.error('[Cron] Import failed:', err)
    }
  })

  // Placeholder for future data pipeline tasks:
  // - Fetch Game Pass catalog
  // - Fetch EA Play catalog
  // - Fetch PS Plus catalog

  console.log('Scheduler started (daily game import at 04:00 UTC)')

  return {
    stop: () => {
      cron.getTasks().forEach((task) => task.stop())
      console.log('Scheduler stopped')
    },
  }
}
