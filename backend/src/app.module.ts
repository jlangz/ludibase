import { Module } from '@nestjs/common'
import { AuthModule } from './http/auth/auth.module'
import { ConfigModule } from './http/config/config.module'
import { DatabaseModule } from './http/database/database.module'
import { CollectionModule } from './http/collection/collection.module'
import { CommonModule } from './http/common/common.module'
import { GamesModule } from './http/games/games.module'
import { HealthModule } from './http/health/health.module'
import { ImportModule } from './http/import/import.module'
import { NewsModule } from './http/news/news.module'
import { ScheduleModule } from './http/schedule/schedule.module'
import { SteamModule } from './http/steam/steam.module'
import { SubscriptionsModule } from './http/subscriptions/subscriptions.module'

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CommonModule,
    AuthModule,
    HealthModule,
    GamesModule,
    NewsModule,
    SubscriptionsModule,
    ImportModule,
    CollectionModule,
    SteamModule,
    ScheduleModule,
  ],
})
export class AppModule {}
