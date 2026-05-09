import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { createRemoteJWKSet } from 'jose'
import type { AppConfig } from '../config/app-config.interface'
import { APP_CONFIG } from '../config/config.tokens'

@Injectable()
export class JwksProvider {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get(): ReturnType<typeof createRemoteJWKSet> {
    if (!this.config.supabaseUrl) {
      throw new ServiceUnavailableException('Authentication not configured')
    }
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(
        new URL(`${this.config.supabaseUrl}/auth/v1/.well-known/jwks.json`),
      )
    }
    return this.jwks
  }

  get issuer(): string {
    if (!this.config.supabaseUrl) {
      throw new ServiceUnavailableException('Authentication not configured')
    }
    return `${this.config.supabaseUrl}/auth/v1`
  }
}
