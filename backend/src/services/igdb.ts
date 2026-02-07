import type { IgdbGame, GameSearchResult } from '../types/igdb.js'

interface IgdbServiceConfig {
  clientId: string
  clientSecret: string
}

interface TokenData {
  accessToken: string
  expiresAt: number // Unix ms
}

export class IgdbService {
  private config: IgdbServiceConfig
  private token: TokenData | null = null

  constructor(config: IgdbServiceConfig) {
    this.config = config
  }

  // --- Token management ---

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.token && Date.now() < this.token.expiresAt - 5 * 60 * 1000) {
      return this.token.accessToken
    }

    const url = new URL('https://id.twitch.tv/oauth2/token')
    url.searchParams.set('client_id', this.config.clientId)
    url.searchParams.set('client_secret', this.config.clientSecret)
    url.searchParams.set('grant_type', 'client_credentials')

    const res = await fetch(url.toString(), { method: 'POST' })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Twitch OAuth failed (${res.status}): ${body}`)
    }

    const data = (await res.json()) as {
      access_token: string
      expires_in: number
      token_type: string
    }

    this.token = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }

    console.log('IGDB: Obtained access token (expires in %d days)', Math.round(data.expires_in / 86400))

    return this.token.accessToken
  }

  private async igdbFetch(endpoint: string, body: string): Promise<unknown> {
    const token = await this.getAccessToken()

    console.log('IGDB request:', endpoint, '\n' + body)

    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': this.config.clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body,
    })

    const text = await res.text()
    console.log('IGDB response (%d):', res.status, text.slice(0, 500))

    if (!res.ok) {
      throw new Error(`IGDB API error (${res.status}): ${text}`)
    }

    return JSON.parse(text)
  }

  // --- Public methods ---

  /**
   * Search for games by title. Returns up to `limit` results.
   * Uses IGDB's Apicalypse query language.
   */
  async searchGames(query: string, limit = 10): Promise<GameSearchResult[]> {
    // Escape double quotes in query to prevent injection into Apicalypse
    const safeQuery = query.replace(/"/g, '\\"')

    const body = [
      `search "${safeQuery}";`,
      'fields name, summary, first_release_date, url,',
      '  cover.image_id,',
      '  platforms.name, platforms.abbreviation,',
      '  genres.name;',
      `limit ${Math.min(limit, 50)};`,
    ].join('\n')

    const raw = (await this.igdbFetch('games', body)) as IgdbGame[]

    return raw.map(mapIgdbGameToResult)
  }

  /**
   * Fetch a single game by its IGDB ID with full details.
   */
  async getGameById(igdbId: number): Promise<GameSearchResult | null> {
    const body = [
      `fields name, summary, first_release_date, url,`,
      '  cover.image_id,',
      '  platforms.name, platforms.abbreviation,',
      '  genres.name;',
      `where id = ${igdbId};`,
    ].join('\n')

    const raw = (await this.igdbFetch('games', body)) as IgdbGame[]

    if (raw.length === 0) return null
    return mapIgdbGameToResult(raw[0])
  }
}

// --- Helpers ---

function mapIgdbGameToResult(game: IgdbGame): GameSearchResult {
  return {
    igdbId: game.id,
    title: game.name,
    summary: game.summary ?? null,
    coverImageId: game.cover?.image_id ?? null,
    platforms: game.platforms?.map((p) => p.abbreviation ?? p.name) ?? [],
    genres: game.genres?.map((g) => g.name) ?? [],
    firstReleaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000).toISOString()
      : null,
    igdbUrl: game.url ?? null,
  }
}
