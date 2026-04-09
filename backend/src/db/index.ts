import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export async function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl)
  const db = drizzle(client, { schema })

  // Ensure GIN trigram index exists for title similarity search.
  // Drizzle can't manage GIN indexes, so we create it on startup.
  await client`CREATE INDEX IF NOT EXISTS games_title_trgm_idx ON games USING gin (title gin_trgm_ops)`

  return { db, client }
}

export type Database = Awaited<ReturnType<typeof createDb>>['db']
