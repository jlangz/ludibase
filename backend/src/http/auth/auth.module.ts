import { Module } from '@nestjs/common'
import { AdminGuard } from './admin.guard'
import { JwksProvider } from './jwks.provider'
import { JwtAuthGuard } from './jwt-auth.guard'

@Module({
  providers: [JwksProvider, JwtAuthGuard, AdminGuard],
  exports: [JwksProvider, JwtAuthGuard, AdminGuard],
})
export class AuthModule {}
