import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { games, gameSubscriptions, profiles, userGameCollection } from '../../db/schema'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { DB } from '../database/database.tokens'
import {
  activeSubscription,
  buildPlatformCondition,
  buildSearchCondition,
  buildSortClause,
  expandServiceTiers,
  inServiceSlugs,
} from '../subscriptions/queries'
import {
  CollectionAllQueryDto,
  CollectionListQueryDto,
  CollectionSubscriptionsQueryDto,
} from './dto/collection-list.dto'
import { UpsertCollectionBodyDto } from './dto/upsert-collection.dto'

@Controller('collection')
@UseGuards(JwtAuthGuard)
export class CollectionController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get()
  async list(
    @CurrentUser('userId') userId: string,
    @Query() query: CollectionListQueryDto,
  ) {
    const q = (query.q ?? '').trim()
    const { sort, platform, page, pageSize, storefront } = query
    const offset = (page - 1) * pageSize

    const conditions = [eq(userGameCollection.userId, userId)]
    if (storefront) {
      conditions.push(
        sql`${userGameCollection.storefronts} @> ${JSON.stringify([storefront])}::jsonb`,
      )
    }
    const searchCond = buildSearchCondition(q)
    if (searchCond) conditions.push(searchCond)
    const platCond = buildPlatformCondition(platform ?? '')
    if (platCond) conditions.push(platCond)

    const where = conditions.length === 1 ? conditions[0] : and(...conditions)

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(userGameCollection)
      .innerJoin(games, eq(games.id, userGameCollection.gameId))
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
        source: userGameCollection.source,
        ownedPlatforms: userGameCollection.ownedPlatforms,
        storefronts: userGameCollection.storefronts,
        steamAppId: userGameCollection.steamAppId,
        steamPlaytimeMinutes: userGameCollection.steamPlaytimeMinutes,
        addedAt: userGameCollection.addedAt,
      })
      .from(userGameCollection)
      .innerJoin(games, eq(games.id, userGameCollection.gameId))
      .where(where)
      .orderBy(buildSortClause(sort))
      .limit(pageSize)
      .offset(offset)

    const sfRows = await this.db
      .select({ storefronts: userGameCollection.storefronts })
      .from(userGameCollection)
      .where(eq(userGameCollection.userId, userId))
    const allStorefronts = [
      ...new Set(sfRows.flatMap((r) => r.storefronts ?? [])),
    ].sort()

    return {
      games: results.map((r) => ({
        ...r,
        firstReleaseDate: r.firstReleaseDate?.toISOString() ?? null,
        addedAt: r.addedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      storefronts: allStorefronts,
    }
  }

  @Post(':igdbId')
  async add(
    @CurrentUser('userId') userId: string,
    @Param('igdbId', ParseIntPipe) igdbId: number,
    @Body() body: UpsertCollectionBodyDto,
  ) {
    if (igdbId <= 0) throw new BadRequestException('Invalid IGDB ID')

    const ownedPlatforms =
      Array.isArray(body.platforms) && body.platforms.length > 0
        ? body.platforms
        : null
    const storefronts =
      Array.isArray(body.storefronts) && body.storefronts.length > 0
        ? body.storefronts
        : null

    const [game] = await this.db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.igdbId, igdbId))
      .limit(1)
    if (!game) throw new NotFoundException('Game not found')

    await this.db
      .insert(userGameCollection)
      .values({
        userId,
        gameId: game.id,
        source: 'manual',
        ownedPlatforms,
        storefronts,
      })
      .onConflictDoUpdate({
        target: [userGameCollection.userId, userGameCollection.gameId],
        set: { ownedPlatforms, storefronts, updatedAt: new Date() },
      })

    return { success: true }
  }

  @Delete(':igdbId')
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('igdbId', ParseIntPipe) igdbId: number,
  ) {
    if (igdbId <= 0) throw new BadRequestException('Invalid IGDB ID')

    const [game] = await this.db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.igdbId, igdbId))
      .limit(1)
    if (!game) throw new NotFoundException('Game not found')

    await this.db
      .delete(userGameCollection)
      .where(
        and(
          eq(userGameCollection.userId, userId),
          eq(userGameCollection.gameId, game.id),
        ),
      )
    return { success: true }
  }

  @Get('check')
  async check(
    @CurrentUser('userId') userId: string,
    @Query('igdbIds') idsParam?: string,
  ): Promise<Record<number, { ownedPlatforms: string[] | null; storefronts: string[] | null } | null>> {
    if (!idsParam) return {}
    const igdbIds = idsParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
    if (igdbIds.length === 0) return {}
    if (igdbIds.length > 100) throw new BadRequestException('Maximum 100 IDs per request')

    const results = await this.db
      .select({
        igdbId: games.igdbId,
        ownedPlatforms: userGameCollection.ownedPlatforms,
        storefronts: userGameCollection.storefronts,
      })
      .from(userGameCollection)
      .innerJoin(games, eq(games.id, userGameCollection.gameId))
      .where(
        and(
          eq(userGameCollection.userId, userId),
          inArray(games.igdbId, igdbIds),
        ),
      )

    const response: Record<number, { ownedPlatforms: string[] | null; storefronts: string[] | null } | null> = {}
    const map = new Map(results.map((r) => [r.igdbId, r]))
    for (const id of igdbIds) {
      const entry = map.get(id)
      response[id] = entry
        ? { ownedPlatforms: entry.ownedPlatforms, storefronts: entry.storefronts }
        : null
    }
    return response
  }

  @Get('subscriptions')
  async subscriptions(
    @CurrentUser('userId') userId: string,
    @Query() query: CollectionSubscriptionsQueryDto,
  ) {
    const q = (query.q ?? '').trim()
    const { sort, platform, page, pageSize, service: serviceParam, overlap } = query
    const overlapOnly = overlap === 'true'
    const offset = (page - 1) * pageSize

    const [profile] = await this.db
      .select({ subscriptions: profiles.subscriptions })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
    const userSubs = profile?.subscriptions ?? []
    if (userSubs.length === 0) {
      return { games: [], total: 0, page, pageSize, services: [] }
    }

    const serviceSlugs = serviceParam
      ? expandServiceTiers([serviceParam])
      : expandServiceTiers(userSubs)

    const conditions = [inServiceSlugs(serviceSlugs), activeSubscription()]
    if (overlapOnly) {
      conditions.push(
        sql`${games.id} IN (SELECT ${userGameCollection.gameId} FROM ${userGameCollection} WHERE ${userGameCollection.userId} = ${userId})`,
      )
    }
    const searchCond = buildSearchCondition(q)
    if (searchCond) conditions.push(searchCond)
    const platCond = buildPlatformCondition(platform ?? '')
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
      })
      .from(gameSubscriptions)
      .innerJoin(games, eq(games.id, gameSubscriptions.gameId))
      .where(where)
      .groupBy(games.id)
      .orderBy(buildSortClause(sort))
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
      services: userSubs,
    }
  }

  @Get('all')
  async all(
    @CurrentUser('userId') userId: string,
    @Query() query: CollectionAllQueryDto,
  ) {
    const q = (query.q ?? '').trim()
    const { sort, platform, page, pageSize } = query
    const offset = (page - 1) * pageSize

    const [profile] = await this.db
      .select({ subscriptions: profiles.subscriptions })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
    const userSubs = profile?.subscriptions ?? []
    const expandedSubs = userSubs.length > 0 ? expandServiceTiers(userSubs) : []

    const ownedGameIds = sql`SELECT ${userGameCollection.gameId} FROM ${userGameCollection} WHERE ${userGameCollection.userId} = ${userId}`
    let allGameIds: ReturnType<typeof sql>
    if (expandedSubs.length > 0) {
      const subGameIds = sql`SELECT ${gameSubscriptions.gameId} FROM ${gameSubscriptions} WHERE ${activeSubscription()} AND ${inServiceSlugs(expandedSubs)}`
      allGameIds = sql`(${ownedGameIds} UNION ${subGameIds})`
    } else {
      allGameIds = sql`(${ownedGameIds})`
    }

    const conditions = [sql`${games.id} IN ${allGameIds}`]
    const searchCond = buildSearchCondition(q)
    if (searchCond) conditions.push(searchCond)
    const platCond = buildPlatformCondition(platform ?? '')
    if (platCond) conditions.push(platCond)
    const where = and(...conditions)

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(games)
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
      })
      .from(games)
      .where(where)
      .orderBy(buildSortClause(sort))
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
}
