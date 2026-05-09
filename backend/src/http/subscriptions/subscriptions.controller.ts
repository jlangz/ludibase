import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '../../db'
import { games, gameSubscriptions } from '../../db/schema'
import type { SubscriptionSyncer } from '../../services/subscription-syncer'
import { AdminGuard } from '../auth/admin.guard'
import { BackgroundTasks } from '../common/background-tasks.service'
import { DB } from '../database/database.tokens'
import {
  SUBSCRIPTION_SYNCER,
} from './providers/subscription-syncer.provider'
import {
  activeSubscription,
  buildPlatformCondition,
  buildSearchCondition,
  buildSortClause,
  inServiceSlugs,
  SERVICE_FAMILIES,
} from './queries'
import { FamilyListingQueryDto } from './dto/family-listing.dto'
import { ServiceListingQueryDto } from './dto/service-listing.dto'
import { SyncQueryDto } from './dto/check.dto'

@Controller()
export class SubscriptionsController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(SUBSCRIPTION_SYNCER) private readonly syncer: SubscriptionSyncer,
    private readonly tasks: BackgroundTasks,
  ) {}

  @Get('games/:igdbId/subscriptions')
  async forGame(@Param('igdbId', ParseIntPipe) igdbId: number) {
    if (igdbId <= 0) throw new BadRequestException('Invalid IGDB ID')

    const results = await this.db
      .select({
        serviceSlug: gameSubscriptions.serviceSlug,
        source: gameSubscriptions.source,
        addedAt: gameSubscriptions.addedAt,
      })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(and(eq(games.igdbId, igdbId), activeSubscription()))

    return {
      igdbId,
      subscriptions: results.map((r) => ({
        service: r.serviceSlug,
        source: r.source,
        addedAt: r.addedAt.toISOString(),
      })),
    }
  }

  @Get('subscriptions/service/:slug')
  async byService(
    @Param('slug') slug: string,
    @Query() { page, pageSize }: ServiceListingQueryDto,
  ) {
    const offset = (page - 1) * pageSize

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(gameSubscriptions)
      .where(and(eq(gameSubscriptions.serviceSlug, slug), activeSubscription()))
    const total = Number(countResult?.count ?? 0)

    const results = await this.db
      .select({
        igdbId: games.igdbId,
        title: games.title,
        slug: games.slug,
        coverImageId: games.coverImageId,
        platforms: games.platforms,
        genres: games.genres,
        developer: games.developer,
        publisher: games.publisher,
        aggregatedRating: games.aggregatedRating,
        firstReleaseDate: games.firstReleaseDate,
      })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(and(eq(gameSubscriptions.serviceSlug, slug), activeSubscription()))
      .orderBy(games.title)
      .limit(pageSize)
      .offset(offset)

    return {
      service: slug,
      games: results.map((r) => ({
        ...r,
        firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
    }
  }

  @Get('subscriptions/check')
  async check(@Query('igdbIds') idsParam?: string) {
    if (!idsParam) throw new BadRequestException('Missing igdbIds parameter')
    const igdbIds = idsParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)

    if (igdbIds.length === 0) throw new BadRequestException('No valid IGDB IDs provided')
    if (igdbIds.length > 100) throw new BadRequestException('Maximum 100 IDs per request')

    const results = await this.db
      .select({
        igdbId: games.igdbId,
        serviceSlug: gameSubscriptions.serviceSlug,
      })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(and(inArray(games.igdbId, igdbIds), activeSubscription()))

    const grouped: Record<number, string[]> = {}
    for (const id of igdbIds) grouped[id] = []
    for (const row of results) {
      if (!grouped[row.igdbId]) grouped[row.igdbId] = []
      grouped[row.igdbId].push(row.serviceSlug)
    }
    return grouped
  }

  @Get('subscriptions/stats')
  async stats() {
    const results = await this.db
      .select({
        serviceSlug: gameSubscriptions.serviceSlug,
        count: sql<number>`count(*)`,
      })
      .from(gameSubscriptions)
      .where(activeSubscription())
      .groupBy(gameSubscriptions.serviceSlug)
      .orderBy(sql`count(*) DESC`)

    return {
      services: results.map((r) => ({
        slug: r.serviceSlug,
        count: Number(r.count),
      })),
    }
  }

  @Post('subscriptions/sync')
  @UseGuards(AdminGuard)
  async sync(@Query() { source }: SyncQueryDto) {
    const taskName = source ? `sync:${source}` : 'sync:all'
    this.tasks.run(taskName, () =>
      source ? this.syncer.runOne(source) : this.syncer.runAll(),
    )
    return {
      status: 'started',
      source: source ?? 'all',
      availableSources: this.syncer.registeredFetchers,
    }
  }

  @Get('subscriptions/family/:family')
  async family(
    @Param('family') familyKey: string,
    @Query() query: FamilyListingQueryDto,
  ) {
    const family = SERVICE_FAMILIES[familyKey]
    if (!family) throw new NotFoundException('Unknown service family')

    const q = (query.q ?? '').trim()
    const { sort, platform: platformFilter, tier: tierFilter, page, pageSize } = query
    const offset = (page - 1) * pageSize

    const targetTiers =
      tierFilter && family.tiers.includes(tierFilter) ? [tierFilter] : family.tiers

    const conditions = [inServiceSlugs(targetTiers), activeSubscription()]
    const searchCond = buildSearchCondition(q)
    if (searchCond) conditions.push(searchCond)
    const platCond = buildPlatformCondition(platformFilter ?? '')
    if (platCond) conditions.push(platCond)

    const where = and(...conditions)

    const [countResult] = await this.db
      .select({ count: sql<number>`count(DISTINCT ${games.id})` })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(where)
    const total = Number(countResult?.count ?? 0)

    const results = await this.db
      .select({
        igdbId: games.igdbId,
        title: games.title,
        slug: games.slug,
        coverImageId: games.coverImageId,
        platforms: games.platforms,
        genres: games.genres,
        developer: games.developer,
        publisher: games.publisher,
        aggregatedRating: games.aggregatedRating,
        firstReleaseDate: games.firstReleaseDate,
        tiers: sql<string[]>`array_agg(DISTINCT ${gameSubscriptions.serviceSlug})`,
      })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(where)
      .groupBy(games.id)
      .orderBy(buildSortClause(sort))
      .limit(pageSize)
      .offset(offset)

    const tierConditions = [inServiceSlugs(family.tiers), activeSubscription()]
    const tierPlatCond = buildPlatformCondition(platformFilter ?? '')
    if (tierPlatCond) tierConditions.push(tierPlatCond)

    const tierCountRows = await this.db
      .select({
        serviceSlug: gameSubscriptions.serviceSlug,
        count: sql<number>`count(DISTINCT ${gameSubscriptions.gameId})`,
      })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(and(...tierConditions))
      .groupBy(gameSubscriptions.serviceSlug)

    const tierTotals: Record<string, number> = {}
    for (const tier of family.tiers) tierTotals[tier] = 0
    for (const row of tierCountRows) tierTotals[row.serviceSlug] = Number(row.count)

    const tierExclusive: Record<string, number> = {}
    for (let i = 0; i < family.tiers.length; i++) {
      const current = tierTotals[family.tiers[i]]
      const lower = i > 0 ? tierTotals[family.tiers[i - 1]] : 0
      tierExclusive[family.tiers[i]] = current - lower
    }

    return {
      family: familyKey,
      name: family.name,
      games: results.map((r) => ({
        ...r,
        firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
      tierCounts: tierTotals,
      tierExclusive,
    }
  }
}
