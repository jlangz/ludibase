import { Module } from '@nestjs/common'
import { GamesController } from './games.controller'
import { igdbProvider, IGDB } from './providers/igdb.provider'
import { pricingProvider, PRICING } from './providers/pricing.provider'

@Module({
  controllers: [GamesController],
  providers: [igdbProvider, pricingProvider],
  exports: [IGDB, PRICING],
})
export class GamesModule {}
