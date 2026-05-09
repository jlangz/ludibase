import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { desc } from 'drizzle-orm'
import type { Database } from '../../db'
import { importRuns } from '../../db/schema'
import type { GameImporter } from '../../services/game-importer'
import { AdminGuard } from '../auth/admin.guard'
import { BackgroundTasks } from '../common/background-tasks.service'
import { DB } from '../database/database.tokens'
import { BulkImportQueryDto } from './dto/bulk-import.dto'
import { GAME_IMPORTER } from './providers/game-importer.provider'

@Controller('import')
export class ImportController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(GAME_IMPORTER) private readonly importer: GameImporter,
    private readonly tasks: BackgroundTasks,
  ) {}

  @Post('bulk')
  @UseGuards(AdminGuard)
  bulk(@Query() { resume }: BulkImportQueryDto) {
    this.tasks.run('import:bulk', () =>
      this.importer.runBulkImport({ resumeFromOffset: resume }),
    )
    return { message: 'Bulk import started', resumeOffset: resume ?? null }
  }

  @Post('incremental')
  @UseGuards(AdminGuard)
  incremental() {
    this.tasks.run('import:incremental', () => this.importer.runIncrementalImport())
    return { message: 'Incremental import started' }
  }

  @Get('status')
  async status() {
    const [latest] = await this.db
      .select()
      .from(importRuns)
      .orderBy(desc(importRuns.startedAt))
      .limit(1)

    if (!latest) throw new NotFoundException('No imports have been run yet')
    return latest
  }
}
