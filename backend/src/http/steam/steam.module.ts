import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import {
  steamImporterProvider,
  steamProvider,
} from './providers/steam.provider'
import { SteamConfiguredGuard } from './steam-configured.guard'
import { SteamController } from './steam.controller'

@Module({
  imports: [AuthModule],
  controllers: [SteamController],
  providers: [steamProvider, steamImporterProvider, SteamConfiguredGuard],
})
export class SteamModule {}
