import dotenv from 'dotenv'
import { defineConfig } from 'drizzle-kit'

dotenv.config({ path: '../.env' })

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    // Use direct connection for migrations (bypasses PgBouncer)
    url: process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL!,
  },
})
