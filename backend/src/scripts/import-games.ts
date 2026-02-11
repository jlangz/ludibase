import { loadConfig } from '../config.js'
import { createDb } from '../db/index.js'
import { IgdbService } from '../services/igdb.js'
import { GameImporter } from '../services/game-importer.js'

const config = loadConfig()
const { db, client } = createDb(config.databaseUrl)
const igdb = new IgdbService({
  clientId: config.twitchClientId,
  clientSecret: config.twitchClientSecret,
})
const importer = new GameImporter(db, igdb)

const args = process.argv.slice(2)
const mode = args[0] ?? 'bulk'
const resumeIdx = args.indexOf('--resume')
const resumeOffset = resumeIdx !== -1 ? parseInt(args[resumeIdx + 1], 10) : undefined

console.log(`[Import] Starting ${mode} import${resumeOffset ? ` (resuming from offset ${resumeOffset})` : ''}...`)
const startTime = Date.now()

try {
  if (mode === 'incremental') {
    const result = await importer.runIncrementalImport({}, (progress) => {
      console.log(
        `  Fetched: ${progress.fetched} | Inserted: ${progress.inserted} | Updated: ${progress.updated} | Offset: ${progress.currentOffset}`
      )
    })
    printSummary(result)
  } else {
    const result = await importer.runBulkImport(
      { resumeFromOffset: resumeOffset },
      (progress) => {
        console.log(
          `  Fetched: ${progress.fetched} | Inserted: ${progress.inserted} | Updated: ${progress.updated} | Offset: ${progress.currentOffset}`
        )
      }
    )
    printSummary(result)
  }
} catch (err) {
  console.error('[Import] Fatal error:', err)
  process.exitCode = 1
} finally {
  await client.end()
}

function printSummary(result: { fetched: number; inserted: number; updated: number; skipped: number }) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n[Import] Done in ${elapsed}s`)
  console.log(`  Total fetched:  ${result.fetched}`)
  console.log(`  Total inserted: ${result.inserted}`)
  console.log(`  Total updated:  ${result.updated}`)
  console.log(`  Total skipped:  ${result.skipped}`)
}
