import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { loadConfig } from './config.js'
import { createDb } from './db/index.js'
import { healthRoutes } from './routes/health.js'
import { gamesRoutes } from './routes/games.js'
import { importRoutes } from './routes/import.js'
import { subscriptionRoutes } from './routes/subscriptions.js'
import { collectionRoutes } from './routes/collection.js'
import { steamRoutes } from './routes/steam.js'
import { newsRoutes } from './routes/news.js'
import { IgdbService } from './services/igdb.js'
import { GameImporter } from './services/game-importer.js'
import { SubscriptionSyncer } from './services/subscription-syncer.js'
import { registerAllFetchers } from './services/register-fetchers.js'
import { startScheduler } from './scheduler/index.js'

const config = await loadConfig()

const { db, client } = await createDb(config.databaseUrl)

// Verify database connection
try {
  await client`SELECT 1`
  console.log('Connected to database')
} catch (err) {
  console.error('Failed to connect to database:', err)
  process.exit(1)
}

const igdb = new IgdbService({
  clientId: config.twitchClientId,
  clientSecret: config.twitchClientSecret,
})

const importer = new GameImporter(db, igdb)
const syncer = new SubscriptionSyncer(db)
registerAllFetchers(syncer, config, db)
const scheduler = startScheduler(importer, syncer)

const app = new Hono()
app.use('*', cors({
  origin: (origin) => {
    if (!process.env.CORS_ORIGIN) return origin || '*'
    if (!origin) return '*'
    // Allow exact match or any subdomain
    const allowed = process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    for (const pattern of allowed) {
      if (origin === pattern) return origin
      if (pattern.startsWith('*.') && origin.endsWith(pattern.slice(1))) return origin
    }
    return null
  },
}))
app.route('/', healthRoutes(db))
app.route('/', gamesRoutes(db, igdb))
app.route('/', importRoutes(db, importer))
app.route('/', subscriptionRoutes(db, syncer))
app.route('/', newsRoutes(db, config.supabaseUrl))

// Collection + Steam (require SUPABASE_URL for JWT verification)
if (config.supabaseUrl) {
  app.route('/', collectionRoutes(db, config.supabaseUrl))

  if (config.steamApiKey) {
    app.route('/', steamRoutes(db, config))
    console.log('Steam integration enabled')
  }
} else {
  console.log('SUPABASE_URL not set — collection/steam routes disabled')
}

const server = serve(
  { fetch: app.fetch, port: config.serverPort },
  (info) => {
    console.log(`Server listening on :${info.port}`)
  }
)

// Graceful shutdown
function shutdown() {
  console.log('Shutting down...')
  scheduler.stop()
  server.close(() => {
    client.end().then(() => {
      console.log('Server stopped')
      process.exit(0)
    })
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
