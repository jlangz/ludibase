import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { NewsController } from './news.controller'

@Module({
  imports: [AuthModule],
  controllers: [NewsController],
})
export class NewsModule {}
