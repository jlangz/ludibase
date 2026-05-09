import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseInterceptors,
} from '@nestjs/common'
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager'
import { eq, sql } from 'drizzle-orm'
import type { Database } from '../../db'
import { games, gameSubscriptions } from '../../db/schema'
import type { IgdbService } from '../../services/igdb'
import type { PricingService } from '../../services/pricing'
import { buildAffiliateUrl } from '../../services/affiliate'
import { DB } from '../database/database.tokens'
import { activeSubscription, expandServiceTiers } from '../subscriptions/queries'
import { IGDB } from './providers/igdb.provider'
import { PRICING } from './providers/pricing.provider'
import { SearchQueryDto } from './dto/search.dto'
import { FilteredSearchQueryDto } from './dto/filtered-search.dto'
import { PopularQueryDto } from './dto/popular.dto'

@Controller('games')
export class GamesController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(IGDB) private readonly igdb: IgdbService,
    @Inject(PRICING) private readonly pricing: PricingService,
  ) {}

  @Get('search')
  async search(@Query() { q, limit }: SearchQueryDto) {
    const term = q.trim()
    const results = await this.db
      .select({
        igdbId: games.igdbId,
        title: games.title,
        slug: games.slug,
        summary: games.summary,
        coverImageId: games.coverImageId,
        platforms: games.platforms,
        genres: games.genres,
        category: games.category,
        developer: games.developer,
        publisher: games.publisher,
        aggregatedRating: games.aggregatedRating,
        ratingCount: games.ratingCount,
        firstReleaseDate: games.firstReleaseDate,
        igdbUrl: games.igdbUrl,
        igdbUpdatedAt: games.igdbUpdatedAt,
      })
      .from(games)
      .where(sql`${games.title} % ${term} OR ${games.title} ILIKE ${'%' + term + '%'}`)
      .orderBy(sql`similarity(${games.title}, ${term}) DESC`)
      .limit(limit)

    return results.map((r) => ({
      ...r,
      firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
    }))
  }

  @Get('search/filtered')
  async searchFiltered(@Query() query: FilteredSearchQueryDto) {
    const term = (query.q ?? '').trim()
    const servicesParam = (query.services ?? '').trim()
    const { page, pageSize } = query
    const offset = (page - 1) * pageSize

    const serviceFilters = servicesParam
      ? expandServiceTiers(
          servicesParam.split(',').map((s) => s.trim()).filter(Boolean),
        )
      : []

    const conditions: ReturnType<typeof sql>[] = []

    if (term.length >= 2) {
      conditions.push(sql`(${games.title} % ${term} OR ${games.title} ILIKE ${'%' + term + '%'})`)
    }

    if (serviceFilters.length > 0) {
      conditions.push(
        sql`${games.id} IN (
          SELECT ${gameSubscriptions.gameId} FROM ${gameSubscriptions}
          WHERE ${activeSubscription()}
          AND ${gameSubscriptions.serviceSlug} IN (${sql.join(
          serviceFilters.map((s) => sql`${s}`),
          sql`, `,
        )})
        )`,
      )
    }

    if (conditions.length === 0) {
      return { games: [], total: 0, page, pageSize }
    }

    const where = conditions.length === 1 ? conditions[0] : sql`${sql.join(conditions, sql` AND `)}`

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(where)
    const total = Number(countResult?.count ?? 0)

    const orderBy =
      term.length >= 2
        ? sql`similarity(${games.title}, ${term}) DESC, ${games.title} ASC`
        : sql`${games.title} ASC`

    const results = await this.db
      .select({
        igdbId: games.igdbId,
        title: games.title,
        slug: games.slug,
        summary: games.summary,
        coverImageId: games.coverImageId,
        platforms: games.platforms,
        genres: games.genres,
        category: games.category,
        developer: games.developer,
        publisher: games.publisher,
        aggregatedRating: games.aggregatedRating,
        ratingCount: games.ratingCount,
        firstReleaseDate: games.firstReleaseDate,
        igdbUrl: games.igdbUrl,
      })
      .from(games)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset)

    return {
      games: results.map((r) => ({
        ...r,
        firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
    }
  }

  @Get('popular')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60 * 60 * 1000)
  async popular(@Query() { limit, page }: PopularQueryDto) {
    const offset = (page - 1) * limit
    const results = await this.db
      .select({
        igdbId: games.igdbId,
        title: games.title,
        slug: games.slug,
        summary: games.summary,
        coverImageId: games.coverImageId,
        platforms: games.platforms,
        genres: games.genres,
        category: games.category,
        developer: games.developer,
        publisher: games.publisher,
        aggregatedRating: games.aggregatedRating,
        ratingCount: games.ratingCount,
        firstReleaseDate: games.firstReleaseDate,
        igdbUrl: games.igdbUrl,
      })
      .from(games)
      .where(
        sql`${games.ratingCount} IS NOT NULL AND ${games.ratingCount} > 0 AND ${games.coverImageId} IS NOT NULL`,
      )
      .orderBy(sql`(${games.ratingCount} * COALESCE(${games.aggregatedRating}, 50)) DESC`)
      .limit(limit)
      .offset(offset)

    return results.map((r) => ({
      ...r,
      firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
    }))
  }

  @Get(':igdbId')
  async byId(@Param('igdbId', ParseIntPipe) igdbId: number) {
    if (igdbId <= 0) throw new NotFoundException('Invalid IGDB ID')

    const [cached] = await this.db
      .select()
      .from(games)
      .where(eq(games.igdbId, igdbId))
      .limit(1)

    if (cached) {
      return {
        igdbId: cached.igdbId,
        title: cached.title,
        slug: cached.slug,
        summary: cached.summary,
        coverImageId: cached.coverImageId,
        platforms: cached.platforms,
        genres: cached.genres,
        category: cached.category,
        developer: cached.developer,
        publisher: cached.publisher,
        aggregatedRating: cached.aggregatedRating,
        ratingCount: cached.ratingCount,
        firstReleaseDate: cached.firstReleaseDate?.toISOString() ?? null,
        igdbUrl: cached.igdbUrl,
        igdbUpdatedAt: cached.igdbUpdatedAt,
        cached: true,
      }
    }

    const game = await this.igdb.getGameById(igdbId)
    if (!game) throw new NotFoundException('Game not found')

    await this.db
      .insert(games)
      .values({
        igdbId: game.igdbId,
        title: game.title,
        slug: game.slug,
        summary: game.summary,
        coverImageId: game.coverImageId,
        firstReleaseDate: game.firstReleaseDate ? new Date(game.firstReleaseDate) : null,
        platforms: game.platforms,
        genres: game.genres,
        category: game.category,
        developer: game.developer,
        publisher: game.publisher,
        aggregatedRating: game.aggregatedRating,
        ratingCount: game.ratingCount,
        igdbUrl: game.igdbUrl,
        igdbUpdatedAt: game.igdbUpdatedAt,
      })
      .onConflictDoNothing()

    return { ...game, cached: false }
  }

  @Get(':igdbId/prices')
  async prices(@Param('igdbId', ParseIntPipe) igdbId: number) {
    if (igdbId <= 0) throw new NotFoundException('Invalid IGDB ID')
    const prices = await this.pricing.getGamePrices(igdbId)
    return {
      prices: prices.map((p) => ({
        ...p,
        url: buildAffiliateUrl(p.store, p.url),
      })),
    }
  }
}
