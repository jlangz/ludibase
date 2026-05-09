import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import type { GameImporter } from '../../services/game-importer'
import type { SubscriptionSyncer } from '../../services/subscription-syncer'
import { GAME_IMPORTER } from '../import/providers/game-importer.provider'
import { SUBSCRIPTION_SYNCER } from '../subscriptions/providers/subscription-syncer.provider'

@Injectable()
export class CronService {
  private readonly logger = new Logger('Cron')

  constructor(
    @Inject(GAME_IMPORTER) private readonly importer: GameImporter,
    @Inject(SUBSCRIPTION_SYNCER) private readonly syncer: SubscriptionSyncer,
  ) {}

  @Cron('0 4 * * *', { timeZone: 'UTC', name: 'daily-import' })
  async dailyIncrementalImport() {
    this.logger.log('Starting daily incremental game import...')
    try {
      const result = await this.importer.runIncrementalImport()
      this.logger.log(
        `Import complete: ${result.inserted} new, ${result.updated} updated`,
      )
    } catch (err) {
      this.logger.error('Import failed', err instanceof Error ? err.stack : err)
    }
  }

  @Cron('0 5 * * *', { timeZone: 'UTC', name: 'daily-sync' })
  async dailySubscriptionSync() {
    this.logger.log('Starting daily subscription sync...')
    try {
      const stats = await this.syncer.runAll()
      const summary = stats
        .map((s) => `${s.source}: +${s.added} -${s.removed}`)
        .join(', ')
      this.logger.log(`Subscription sync complete: ${summary}`)
    } catch (err) {
      this.logger.error('Subscription sync failed', err instanceof Error ? err.stack : err)
    }
  }
}
