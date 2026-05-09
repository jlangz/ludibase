import { Provider } from '@nestjs/common'
import { IgdbService } from '../../../services/igdb'
import { APP_CONFIG } from '../../config/config.tokens'
import type { AppConfig } from '../../config/app-config.interface'

export const IGDB = Symbol('IGDB')

export const igdbProvider: Provider = {
  provide: IGDB,
  inject: [APP_CONFIG],
  useFactory: (config: AppConfig) =>
    new IgdbService({
      clientId: config.twitchClientId,
      clientSecret: config.twitchClientSecret,
    }),
}
