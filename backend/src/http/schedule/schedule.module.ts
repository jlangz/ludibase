import { Module } from '@nestjs/common'
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule'
import { ImportModule } from '../import/import.module'
import { SubscriptionsModule } from '../subscriptions/subscriptions.module'
import { CronService } from './cron.service'

@Module({
  imports: [NestScheduleModule.forRoot(), ImportModule, SubscriptionsModule],
  providers: [CronService],
})
export class ScheduleModule {}
