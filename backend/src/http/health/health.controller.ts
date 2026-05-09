import { Controller, Get, Inject } from '@nestjs/common'
import type { Sql } from 'postgres'
import { PG_CLIENT } from '../database/database.tokens'

@Controller('health')
export class HealthController {
  constructor(@Inject(PG_CLIENT) private readonly client: Sql) {}

  @Get()
  async check() {
    try {
      await this.client`SELECT 1`
      return { status: 'ok' as const, database: 'ok' as const }
    } catch {
      return { status: 'degraded' as const, database: 'error' as const }
    }
  }
}
