import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { loadConfig } from './config.js'
import { createDb } from './db/index.js'
import { healthRoutes } from './routes/health.js'
import { startScheduler } from './scheduler/index.js'

const config = loadConfig()

const { db, client } = createDb(config.databaseUrl)

// Verify database connection
try {
  await client`SELECT 1`
  console.log('Connected to database')
} catch (err) {
  console.error('Failed to connect to database:', err)
  process.exit(1)
}

const scheduler = startScheduler()

const app = new Hono()
app.route('/', healthRoutes(db))

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
