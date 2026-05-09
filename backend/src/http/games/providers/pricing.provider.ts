import { Provider } from '@nestjs/common'
import { PricingService } from '../../../services/pricing'
import type { Database } from '../../../db'
import { DB } from '../../database/database.tokens'

export const PRICING = Symbol('PRICING')

export const pricingProvider: Provider = {
  provide: PRICING,
  inject: [DB],
  useFactory: (db: Database) => new PricingService(db),
}
