import 'dotenv/config'

export interface Config {
  databaseUrl: string
  serverPort: number
}

export function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  const serverPort = parseInt(process.env.SERVER_PORT || '8080', 10)

  return { databaseUrl, serverPort }
}
