import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import {
  subscriptionSyncerProvider,
  SUBSCRIPTION_SYNCER,
} from './providers/subscription-syncer.provider'
import { SubscriptionsController } from './subscriptions.controller'

@Module({
  imports: [AuthModule],
  controllers: [SubscriptionsController],
  providers: [subscriptionSyncerProvider],
  exports: [SUBSCRIPTION_SYNCER],
})
export class SubscriptionsModule {}
