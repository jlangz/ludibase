import { Module } from '@nestjs/common'
import { CacheModule } from '@nestjs/cache-manager'
import { GamesController } from './games.controller'
import { igdbProvider, IGDB } from './providers/igdb.provider'
import { pricingProvider, PRICING } from './providers/pricing.provider'

@Module({
  imports: [CacheModule.register()],
  controllers: [GamesController],
  providers: [igdbProvider, pricingProvider],
  exports: [IGDB, PRICING],
})
export class GamesModule {}
