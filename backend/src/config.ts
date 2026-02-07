import 'dotenv/config'

export interface Config {
  databaseUrl: string
  serverPort: number
  twitchClientId: string
  twitchClientSecret: string
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

  return { databaseUrl, serverPort, twitchClientId, twitchClientSecret }
}
