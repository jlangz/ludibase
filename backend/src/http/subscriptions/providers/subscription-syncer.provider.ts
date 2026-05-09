import { Provider } from '@nestjs/common'
import { SubscriptionSyncer } from '../../../services/subscription-syncer'
import { registerAllFetchers } from '../../../services/register-fetchers'
import type { Database } from '../../../db'
import type { AppConfig } from '../../config/app-config.interface'
import { APP_CONFIG } from '../../config/config.tokens'
import { DB } from '../../database/database.tokens'

export const SUBSCRIPTION_SYNCER = Symbol('SUBSCRIPTION_SYNCER')

export const subscriptionSyncerProvider: Provider = {
  provide: SUBSCRIPTION_SYNCER,
  inject: [DB, APP_CONFIG],
  useFactory: (db: Database, config: AppConfig) => {
    const syncer = new SubscriptionSyncer(db)
    registerAllFetchers(syncer, config, db)
    return syncer
  },
}
