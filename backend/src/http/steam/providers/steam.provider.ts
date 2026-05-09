import { Provider } from '@nestjs/common'
import { SteamService } from '../../../services/steam'
import { SteamImporter } from '../../../services/steam-importer'
import type { Database } from '../../../db'
import type { AppConfig } from '../../config/app-config.interface'
import { APP_CONFIG } from '../../config/config.tokens'
import { DB } from '../../database/database.tokens'

export const STEAM = Symbol('STEAM')
export const STEAM_IMPORTER = Symbol('STEAM_IMPORTER')

export const steamProvider: Provider = {
  provide: STEAM,
  inject: [APP_CONFIG],
  useFactory: (config: AppConfig) => new SteamService(config.steamApiKey ?? ''),
}

export const steamImporterProvider: Provider = {
  provide: STEAM_IMPORTER,
  inject: [DB, STEAM],
  useFactory: (db: Database, steam: SteamService) => new SteamImporter(db, steam),
}
