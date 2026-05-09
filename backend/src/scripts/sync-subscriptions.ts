import { loadConfig } from '../config'
import { createDb } from '../db/index'
import { SubscriptionSyncer } from '../services/subscription-syncer'
import { registerAllFetchers } from '../services/register-fetchers'

async function main() {
  const config = await loadConfig()
  const { db, client } = await createDb(config.databaseUrl)
  const syncer = new SubscriptionSyncer(db)
  registerAllFetchers(syncer, config, db)

  const args = process.argv.slice(2)
  const source = args[0] // optional: run single fetcher

  console.log(`[Sync] Starting subscription sync${source ? ` (source: ${source})` : ' (all sources)'}...`)
  console.log(`[Sync] Available fetchers: ${syncer.registeredFetchers.join(', ')}`)
  const startTime = Date.now()

  try {
    const stats = source ? await syncer.runOne(source) : await syncer.runAll()

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n[Sync] Done in ${elapsed}s`)
    for (const s of stats) {
      console.log(`  ${s.source}: checked=${s.checked} added=${s.added} removed=${s.removed} unchanged=${s.unchanged} unmatched=${s.unmatched}`)
    }
  } catch (err) {
    console.error('[Sync] Fatal error:', err)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('[Sync] Unhandled error:', err)
  process.exit(1)
})
