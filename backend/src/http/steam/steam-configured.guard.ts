import { CanActivate, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common'
import type { AppConfig } from '../config/app-config.interface'
import { APP_CONFIG } from '../config/config.tokens'

@Injectable()
export class SteamConfiguredGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(): boolean {
    if (!this.config.steamApiKey) {
      throw new ServiceUnavailableException('Steam integration not configured')
    }
    return true
  }
}
