import { Logger, Provider } from '@nestjs/common'
import { createDb } from '../../db'
import type { AppConfig } from '../config/app-config.interface'
import { APP_CONFIG } from '../config/config.tokens'
import { DB, PG_CLIENT } from './database.tokens'

type DbBundle = Awaited<ReturnType<typeof createDb>>

const DB_BUNDLE = Symbol('DB_BUNDLE')

export const databaseProviders: Provider[] = [
  {
    provide: DB_BUNDLE,
    inject: [APP_CONFIG],
    useFactory: async (config: AppConfig): Promise<DbBundle> => {
      const logger = new Logger('Database')
      const bundle = await createDb(config.databaseUrl)
      await bundle.client`SELECT 1`
      logger.log('Connected to database')
      return bundle
    },
  },
  {
    provide: DB,
    inject: [DB_BUNDLE],
    useFactory: (bundle: DbBundle) => bundle.db,
  },
  {
    provide: PG_CLIENT,
    inject: [DB_BUNDLE],
    useFactory: (bundle: DbBundle) => bundle.client,
  },
]
