import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '../../db'
import { savedArticles } from '../../db/schema'
import { getNews } from '../../services/news'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { DB } from '../database/database.tokens'
import { NewsListQueryDto } from './dto/news-list.dto'
import { SaveArticleDto, UnsaveArticleDto } from './dto/save-news.dto'
import { SavedCheckQueryDto, SavedListQueryDto } from './dto/saved-list.dto'

@Controller('news')
export class NewsController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get()
  async list(@Query() { limit }: NewsListQueryDto) {
    const items = await getNews(limit)
    return { items }
  }

  @Post('save')
  @UseGuards(JwtAuthGuard)
  async save(@CurrentUser('userId') userId: string, @Body() body: SaveArticleDto) {
    await this.db
      .insert(savedArticles)
      .values({
        userId,
        articleUrl: body.url,
        title: body.title,
        description: body.description ?? null,
        imageUrl: body.imageUrl ?? null,
        source: body.source,
        pubDate: body.pubDate ? new Date(body.pubDate) : null,
      })
      .onConflictDoNothing()
    return { success: true }
  }

  @Delete('save')
  @UseGuards(JwtAuthGuard)
  async unsave(@CurrentUser('userId') userId: string, @Body() body: UnsaveArticleDto) {
    await this.db
      .delete(savedArticles)
      .where(
        and(eq(savedArticles.userId, userId), eq(savedArticles.articleUrl, body.url)),
      )
    return { success: true }
  }

  @Get('saved')
  @UseGuards(JwtAuthGuard)
  async listSaved(
    @CurrentUser('userId') userId: string,
    @Query() { page, pageSize }: SavedListQueryDto,
  ) {
    const offset = (page - 1) * pageSize

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(savedArticles)
      .where(eq(savedArticles.userId, userId))
    const total = Number(countResult?.count ?? 0)

    const results = await this.db
      .select()
      .from(savedArticles)
      .where(eq(savedArticles.userId, userId))
      .orderBy(sql`${savedArticles.savedAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    return {
      articles: results.map((r) => ({
        url: r.articleUrl,
        title: r.title,
        description: r.description,
        imageUrl: r.imageUrl,
        source: r.source,
        pubDate: r.pubDate?.toISOString() ?? null,
        savedAt: r.savedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    }
  }

  @Get('saved/check')
  @UseGuards(JwtAuthGuard)
  async checkSaved(
    @CurrentUser('userId') userId: string,
    @Query() { urls: urlsParam }: SavedCheckQueryDto,
  ): Promise<Record<string, boolean>> {
    if (!urlsParam) return {}
    const urls = urlsParam
      .split(',')
      .map((u) => decodeURIComponent(u.trim()))
      .filter(Boolean)
    if (urls.length === 0) return {}

    const results = await this.db
      .select({ articleUrl: savedArticles.articleUrl })
      .from(savedArticles)
      .where(
        and(
          eq(savedArticles.userId, userId),
          inArray(savedArticles.articleUrl, urls),
        ),
      )

    const saved = new Set(results.map((r) => r.articleUrl))
    const response: Record<string, boolean> = {}
    for (const url of urls) response[url] = saved.has(url)
    return response
  }
}
