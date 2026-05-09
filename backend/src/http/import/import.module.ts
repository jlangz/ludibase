import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { GamesModule } from '../games/games.module'
import { ImportController } from './import.controller'
import {
  gameImporterProvider,
  GAME_IMPORTER,
} from './providers/game-importer.provider'

@Module({
  imports: [AuthModule, GamesModule],
  controllers: [ImportController],
  providers: [gameImporterProvider],
  exports: [GAME_IMPORTER],
})
export class ImportModule {}
