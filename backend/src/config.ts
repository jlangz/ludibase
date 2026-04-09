import dotenv from 'dotenv'
import { resolve } from 'path'

// Load .env from project root (one level up from backend/)
dotenv.config({ path: resolve(import.meta.dirname, '../../.env') })

export interface Config {
  databaseUrl: string
  serverPort: number
  twitchClientId: string
  twitchClientSecret: string
  itadApiKey?: string
  platPricesApiKey?: string
  steamApiKey?: string
  supabaseUrl?: string
  publicUrl: string
}

export function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  const twitchClientId = process.env.TWITCH_CLIENT_ID
  if (!twitchClientId) {
    throw new Error('TWITCH_CLIENT_ID is required (register at dev.twitch.tv)')
  }

  const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!twitchClientSecret) {
    throw new Error('TWITCH_CLIENT_SECRET is required (register at dev.twitch.tv)')
  }

  const serverPort = parseInt(process.env.SERVER_PORT || '8080', 10)

  const itadApiKey = process.env.ITAD_API_KEY || undefined
  const platPricesApiKey = process.env.PLAT_PRICES || undefined
  const steamApiKey = process.env.STEAM_API_KEY || undefined
  const supabaseUrl = process.env.SUPABASE_URL || undefined
  const publicUrl = process.env.PUBLIC_URL || `http://localhost:${serverPort}`

  return { databaseUrl, serverPort, twitchClientId, twitchClientSecret, itadApiKey, platPricesApiKey, steamApiKey, supabaseUrl, publicUrl }
}
