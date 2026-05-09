import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import type { AppConfig } from '../config/app-config.interface'
import { APP_CONFIG } from '../config/config.tokens'

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.config.adminKey) {
      throw new ForbiddenException('Admin endpoints disabled (ADMIN_KEY not configured)')
    }
    const req = ctx.switchToHttp().getRequest<Request>()
    const provided = req.headers['x-admin-key']
    if (provided !== this.config.adminKey) {
      throw new UnauthorizedException('Unauthorized')
    }
    return true
  }
}
