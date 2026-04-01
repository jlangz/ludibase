import cron from 'node-cron'
import type { GameImporter } from '../services/game-importer.js'
import type { SubscriptionSyncer } from '../services/subscription-syncer.js'

export function startScheduler(importer: GameImporter, syncer: SubscriptionSyncer) {
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

  // Daily subscription sync at 5:00 AM UTC (after game import finishes)
  cron.schedule('0 5 * * *', async () => {
    console.log('[Cron] Starting daily subscription sync...')
    try {
      const stats = await syncer.runAll()
      const summary = stats.map((s) => `${s.source}: +${s.added} -${s.removed}`).join(', ')
      console.log(`[Cron] Subscription sync complete: ${summary}`)
    } catch (err) {
      console.error('[Cron] Subscription sync failed:', err)
    }
  })

  console.log('Scheduler started (game import 04:00 UTC, subscription sync 05:00 UTC)')

  return {
    stop: () => {
      cron.getTasks().forEach((task) => task.stop())
      console.log('Scheduler stopped')
    },
  }
}
