import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CollectionController } from './collection.controller'

@Module({
  imports: [AuthModule],
  controllers: [CollectionController],
})
export class CollectionModule {}
