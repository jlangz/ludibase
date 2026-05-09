import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Inject,
  InternalServerErrorException,
  Logger,
  Post,
  Query,
  Redirect,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { SignJWT, jwtVerify } from 'jose'
import type { Database } from '../../db'
import { steamConnections } from '../../db/schema'
import type { SteamService } from '../../services/steam'
import type { SteamImporter } from '../../services/steam-importer'
import type { AppConfig } from '../config/app-config.interface'
import { APP_CONFIG } from '../config/config.tokens'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { DB } from '../database/database.tokens'
import { STEAM, STEAM_IMPORTER } from './providers/steam.provider'
import { SteamConfiguredGuard } from './steam-configured.guard'

@Controller('steam')
@UseGuards(SteamConfiguredGuard)
export class SteamController {
  private readonly logger = new Logger(SteamController.name)

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(STEAM) private readonly steam: SteamService,
    @Inject(STEAM_IMPORTER) private readonly importer: SteamImporter,
  ) {}

  private get stateSecret() {
    return new TextEncoder().encode(this.config.steamApiKey ?? '')
  }

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  async connect(@CurrentUser('userId') userId: string) {
    const state = await new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .sign(this.stateSecret)

    const callbackUrl = `${this.config.publicUrl}/steam/callback?state=${encodeURIComponent(state)}`
    return { url: this.steam.getLoginUrl(callbackUrl) }
  }

  @Get('callback')
  @Redirect()
  async callback(@Query() rawQuery: Record<string, string>) {
    const state = rawQuery.state
    if (!state) throw new BadRequestException('Missing state parameter')

    let userId: string
    try {
      const { payload } = await jwtVerify(state, this.stateSecret, {
        algorithms: ['HS256'],
      })
      if (!payload.sub) throw new UnauthorizedException('Invalid state token')
      userId = payload.sub
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err
      throw new UnauthorizedException('Invalid or expired state')
    }

    const params: Record<string, string> = {}
    for (const [key, value] of Object.entries(rawQuery)) {
      if (key.startsWith('openid.') && typeof value === 'string') {
        params[key] = value
      }
    }

    const steamId = await this.steam.verifyCallback(params)
    if (!steamId) throw new UnauthorizedException('Steam verification failed')

    const profile = await this.steam.getPlayerSummary(steamId)

    await this.db
      .insert(steamConnections)
      .values({
        userId,
        steamId,
        steamUsername: profile?.personaname ?? null,
        steamAvatarUrl: profile?.avatarfull ?? null,
      })
      .onConflictDoUpdate({
        target: steamConnections.userId,
        set: {
          steamId,
          steamUsername: profile?.personaname ?? null,
          steamAvatarUrl: profile?.avatarfull ?? null,
          connectedAt: new Date(),
        },
      })

    return { url: `${this.config.frontendUrl}/profile?steam=connected` }
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status(@CurrentUser('userId') userId: string) {
    const [connection] = await this.db
      .select()
      .from(steamConnections)
      .where(eq(steamConnections.userId, userId))
      .limit(1)
    if (!connection) return null
    return {
      steamId: connection.steamId,
      steamUsername: connection.steamUsername,
      steamAvatarUrl: connection.steamAvatarUrl,
      connectedAt: connection.connectedAt.toISOString(),
      lastImportAt: connection.lastImportAt?.toISOString() ?? null,
    }
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  async import(@CurrentUser('userId') userId: string) {
    const [connection] = await this.db
      .select()
      .from(steamConnections)
      .where(eq(steamConnections.userId, userId))
      .limit(1)
    if (!connection) throw new BadRequestException('No Steam account connected')

    try {
      return await this.importer.importLibrary(userId, connection.steamId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      this.logger.error(`Import error: ${message}`)
      throw new InternalServerErrorException(message)
    }
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser('userId') userId: string) {
    await this.db
      .delete(steamConnections)
      .where(eq(steamConnections.userId, userId))
    return { success: true }
  }
}
