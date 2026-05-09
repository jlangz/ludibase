import { Provider } from '@nestjs/common'
import { GameImporter } from '../../../services/game-importer'
import type { Database } from '../../../db'
import type { IgdbService } from '../../../services/igdb'
import { DB } from '../../database/database.tokens'
import { IGDB } from '../../games/providers/igdb.provider'

export const GAME_IMPORTER = Symbol('GAME_IMPORTER')

export const gameImporterProvider: Provider = {
  provide: GAME_IMPORTER,
  inject: [DB, IGDB],
  useFactory: (db: Database, igdb: IgdbService) => new GameImporter(db, igdb),
}
