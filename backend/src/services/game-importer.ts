import { eq, sql, max } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import type { IgdbService } from './igdb.js'
import type { IgdbGame } from '../types/igdb.js'
import { games, importRuns } from '../db/schema.js'

// IGDB platform IDs for subscription-relevant platforms
const PLATFORM_IDS = [6, 48, 49, 130, 167, 169] // PC, PS4, XONE, Switch, PS5, Series X|S

const IMPORT_FIELDS = [
  'fields name, slug, summary, first_release_date, url, updated_at, category,',
  '  cover.image_id,',
  '  platforms.name, platforms.abbreviation,',
  '  genres.name,',
  '  involved_companies.company.name, involved_companies.developer, involved_companies.publisher,',
  '  aggregated_rating, aggregated_rating_count;',
].join('\n')

// Note: IGDB omits category=0 (main_game) from responses and filtering on it
// returns no results. We rely on platforms + cover to get relevant games.
// Category is still stored when IGDB provides it (DLC, expansion, etc.).
const BASE_WHERE = `where platforms = (${PLATFORM_IDS.join(',')}) & cover != null`

export interface ImportOptions {
  resumeFromOffset?: number
  batchSize?: number        // IGDB results per request, max 500
  requestDelayMs?: number   // Delay between requests, default 260ms
}

export interface ImportProgress {
  runId: number
  fetched: number
  inserted: number
  updated: number
  skipped: number
  currentOffset: number
}

export type ProgressCallback = (progress: ImportProgress) => void

export class GameImporter {
  constructor(
    private db: Database,
    private igdb: IgdbService,
  ) {}

  async runBulkImport(options?: ImportOptions, onProgress?: ProgressCallback): Promise<ImportProgress> {
    const batchSize = Math.min(options?.batchSize ?? 500, 500)
    const delayMs = options?.requestDelayMs ?? 260
    const startOffset = options?.resumeFromOffset ?? 0

    // Prevent concurrent imports
    await this.checkNoRunningImport()

    const filterQuery = BASE_WHERE
    const [run] = await this.db.insert(importRuns).values({
      type: 'bulk',
      status: 'running',
      filterQuery,
      lastOffset: startOffset,
    }).returning()

    this.igdb.setVerbose(false)

    const progress: ImportProgress = {
      runId: run.id,
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      currentOffset: startOffset,
    }

    try {
      let offset = startOffset

      while (true) {
        const query = [
          IMPORT_FIELDS,
          `${filterQuery};`,
          `sort id asc;`,
          `limit ${batchSize};`,
          `offset ${offset};`,
        ].join('\n')

        const batch = await this.igdb.queryGames(query)
        progress.fetched += batch.length

        if (batch.length > 0) {
          const result = await this.upsertBatch(batch)
          progress.inserted += result.inserted
          progress.updated += result.updated
          progress.skipped += result.skipped
        }

        offset += batchSize
        progress.currentOffset = offset

        // Update import_runs with progress
        await this.db.update(importRuns)
          .set({
            totalFetched: progress.fetched,
            totalInserted: progress.inserted,
            totalUpdated: progress.updated,
            totalSkipped: progress.skipped,
            lastOffset: offset,
          })
          .where(eq(importRuns.id, run.id))

        onProgress?.(progress)

        if (batch.length < batchSize) break

        await sleep(delayMs)
      }

      // Mark completed
      await this.db.update(importRuns)
        .set({
          status: 'completed',
          totalFetched: progress.fetched,
          totalInserted: progress.inserted,
          totalUpdated: progress.updated,
          totalSkipped: progress.skipped,
          completedAt: new Date(),
        })
        .where(eq(importRuns.id, run.id))

      console.log(`[Import] Bulk import completed: ${progress.fetched} fetched, ${progress.inserted} inserted, ${progress.updated} updated`)

      return progress
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.db.update(importRuns)
        .set({
          status: 'failed',
          errorMessage: message,
          totalFetched: progress.fetched,
          totalInserted: progress.inserted,
          totalUpdated: progress.updated,
          totalSkipped: progress.skipped,
        })
        .where(eq(importRuns.id, run.id))

      console.error(`[Import] Bulk import failed at offset ${progress.currentOffset}: ${message}`)
      throw err
    } finally {
      this.igdb.setVerbose(true)
    }
  }

  async runIncrementalImport(options?: ImportOptions, onProgress?: ProgressCallback): Promise<ImportProgress> {
    const batchSize = Math.min(options?.batchSize ?? 500, 500)
    const delayMs = options?.requestDelayMs ?? 260

    // Get the latest igdb_updated_at from local games
    const [result] = await this.db.select({ maxUpdated: max(games.igdbUpdatedAt) }).from(games)
    const cutoff = result?.maxUpdated

    if (cutoff == null) {
      console.log('[Import] No existing games found, falling back to bulk import')
      return this.runBulkImport(options, onProgress)
    }

    await this.checkNoRunningImport()

    const filterQuery = `${BASE_WHERE} & updated_at > ${cutoff}`
    const [run] = await this.db.insert(importRuns).values({
      type: 'incremental',
      status: 'running',
      filterQuery,
    }).returning()

    this.igdb.setVerbose(false)

    const progress: ImportProgress = {
      runId: run.id,
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      currentOffset: 0,
    }

    try {
      let offset = 0

      while (true) {
        const query = [
          IMPORT_FIELDS,
          `${filterQuery};`,
          `sort updated_at asc;`,
          `limit ${batchSize};`,
          `offset ${offset};`,
        ].join('\n')

        const batch = await this.igdb.queryGames(query)
        progress.fetched += batch.length

        if (batch.length > 0) {
          const result = await this.upsertBatch(batch)
          progress.inserted += result.inserted
          progress.updated += result.updated
          progress.skipped += result.skipped
        }

        offset += batchSize
        progress.currentOffset = offset

        await this.db.update(importRuns)
          .set({
            totalFetched: progress.fetched,
            totalInserted: progress.inserted,
            totalUpdated: progress.updated,
            totalSkipped: progress.skipped,
            lastOffset: offset,
          })
          .where(eq(importRuns.id, run.id))

        onProgress?.(progress)

        if (batch.length < batchSize) break

        await sleep(delayMs)
      }

      await this.db.update(importRuns)
        .set({
          status: 'completed',
          totalFetched: progress.fetched,
          totalInserted: progress.inserted,
          totalUpdated: progress.updated,
          totalSkipped: progress.skipped,
          completedAt: new Date(),
        })
        .where(eq(importRuns.id, run.id))

      console.log(`[Import] Incremental import completed: ${progress.fetched} fetched, ${progress.inserted} inserted, ${progress.updated} updated`)

      return progress
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.db.update(importRuns)
        .set({
          status: 'failed',
          errorMessage: message,
          totalFetched: progress.fetched,
          totalInserted: progress.inserted,
          totalUpdated: progress.updated,
          totalSkipped: progress.skipped,
        })
        .where(eq(importRuns.id, run.id))

      console.error(`[Import] Incremental import failed: ${message}`)
      throw err
    } finally {
      this.igdb.setVerbose(true)
    }
  }

  private async checkNoRunningImport() {
    const [running] = await this.db
      .select()
      .from(importRuns)
      .where(eq(importRuns.status, 'running'))
      .limit(1)

    if (running) {
      throw new Error(`Import already running (run ID: ${running.id}, started: ${running.startedAt.toISOString()})`)
    }
  }

  private async upsertBatch(batch: IgdbGame[]): Promise<{ inserted: number; updated: number; skipped: number }> {
    const rows = batch.map(mapIgdbGameToRow)

    // Use raw SQL for upsert to get insert vs update counts
    // Drizzle's onConflictDoUpdate doesn't tell us which rows were inserted vs updated
    // So we do a simple upsert and count based on what exists
    const existingIds = new Set(
      (await this.db
        .select({ igdbId: games.igdbId })
        .from(games)
        .where(sql`${games.igdbId} IN (${sql.join(rows.map(r => sql`${r.igdbId}`), sql`, `)})`)
      ).map(r => r.igdbId)
    )

    await this.db.insert(games)
      .values(rows)
      .onConflictDoUpdate({
        target: games.igdbId,
        set: {
          title: sql`excluded.title`,
          slug: sql`excluded.slug`,
          summary: sql`excluded.summary`,
          coverImageId: sql`excluded.cover_image_id`,
          firstReleaseDate: sql`excluded.first_release_date`,
          platforms: sql`excluded.platforms`,
          genres: sql`excluded.genres`,
          category: sql`excluded.category`,
          developer: sql`excluded.developer`,
          publisher: sql`excluded.publisher`,
          aggregatedRating: sql`excluded.aggregated_rating`,
          ratingCount: sql`excluded.rating_count`,
          igdbUrl: sql`excluded.igdb_url`,
          igdbUpdatedAt: sql`excluded.igdb_updated_at`,
          updatedAt: sql`now()`,
        },
      })

    const inserted = rows.filter(r => !existingIds.has(r.igdbId)).length
    const updated = rows.filter(r => existingIds.has(r.igdbId)).length

    return { inserted, updated, skipped: 0 }
  }
}

function mapIgdbGameToRow(game: IgdbGame) {
  const developers = game.involved_companies?.filter(ic => ic.developer) ?? []
  const publishers = game.involved_companies?.filter(ic => ic.publisher) ?? []

  return {
    igdbId: game.id,
    title: game.name,
    slug: game.slug ?? null,
    summary: game.summary ?? null,
    coverImageId: game.cover?.image_id ?? null,
    firstReleaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000)
      : null,
    platforms: game.platforms?.map(p => p.abbreviation ?? p.name) ?? [],
    genres: game.genres?.map(g => g.name) ?? [],
    category: game.category ?? null,
    developer: developers[0]?.company.name ?? null,
    publisher: publishers[0]?.company.name ?? null,
    aggregatedRating: game.aggregated_rating
      ? Math.round(game.aggregated_rating)
      : null,
    ratingCount: game.aggregated_rating_count ?? null,
    igdbUrl: game.url ?? null,
    igdbUpdatedAt: game.updated_at ?? null,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
