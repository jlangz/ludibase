import dotenv from 'dotenv'
import { resolve } from 'path'
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm'

// Load .env from project root for local development
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
  frontendUrl: string
}

/**
 * Load config from AWS Parameter Store (production) or .env (local dev).
 * Set LUDIBASE_ENV=prod or LUDIBASE_ENV=staging to use Parameter Store.
 */
export async function loadConfig(): Promise<Config> {
  const env = process.env.LUDIBASE_ENV // 'prod' | 'staging' | undefined (local)

  if (env) {
    console.log(`[Config] Loading from Parameter Store (${env})...`)
    try {
      await loadFromParameterStore(env)
    } catch (err) {
      console.error(`[Config] Failed to load from Parameter Store:`, err instanceof Error ? err.message : err)
      throw err
    }
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const twitchClientId = process.env.TWITCH_CLIENT_ID
  if (!twitchClientId) throw new Error('TWITCH_CLIENT_ID is required')

  const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!twitchClientSecret) throw new Error('TWITCH_CLIENT_SECRET is required')

  const serverPort = parseInt(process.env.SERVER_PORT || '8080', 10)
  const itadApiKey = process.env.ITAD_API_KEY || undefined
  const platPricesApiKey = process.env.PLAT_PRICES || undefined
  const steamApiKey = process.env.STEAM_API_KEY || undefined
  const supabaseUrl = process.env.SUPABASE_URL || undefined
  const publicUrl = process.env.PUBLIC_URL || `http://localhost:${serverPort}`
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

  return { databaseUrl, serverPort, twitchClientId, twitchClientSecret, itadApiKey, platPricesApiKey, steamApiKey, supabaseUrl, publicUrl, frontendUrl }
}

async function loadFromParameterStore(env: string) {
  const ssm = new SSMClient({ region: 'us-east-1' })

  // Load shared params + env-specific params
  const paths = [`/ludibase/shared/`, `/ludibase/${env}/`]

  for (const path of paths) {
    let nextToken: string | undefined
    do {
      const cmd = new GetParametersByPathCommand({
        Path: path,
        WithDecryption: true,
        NextToken: nextToken,
      })
      const result = await ssm.send(cmd)

      for (const param of result.Parameters ?? []) {
        // Extract key name from path: /ludibase/shared/DATABASE_URL -> DATABASE_URL
        const key = param.Name?.split('/').pop()
        if (key && param.Value) {
          process.env[key] = param.Value
        }
      }

      nextToken = result.NextToken
    } while (nextToken)
  }

  console.log(`[Config] Parameters loaded from SSM`)
}
