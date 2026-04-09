/**
 * Steam integration service — handles OpenID 2.0 auth flow and Steam Web API calls.
 *
 * OpenID flow:
 *   1. Build redirect URL → steamcommunity.com/openid/login
 *   2. User authenticates on Steam
 *   3. Steam redirects to callback with signed params
 *   4. Verify signature by POSTing back to Steam
 *   5. Extract SteamID from openid.claimed_id
 *
 * Steam Web API:
 *   - GetOwnedGames: fetch user's game library
 *   - GetPlayerSummaries: fetch display name / avatar
 */

export interface SteamOwnedGame {
  appid: number
  name: string
  playtime_forever: number
}

export interface SteamPlayerSummary {
  personaname: string
  avatarfull: string
  communityvisibilitystate: number // 3 = public
}

export class SteamService {
  constructor(private apiKey: string) {}

  /** Build the Steam OpenID redirect URL. */
  getLoginUrl(callbackUrl: string): string {
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': callbackUrl,
      'openid.realm': new URL(callbackUrl).origin,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    })
    return `https://steamcommunity.com/openid/login?${params}`
  }

  /** Verify the OpenID callback and extract the SteamID. Returns null if invalid. */
  async verifyCallback(params: Record<string, string>): Promise<string | null> {
    // Build verification request — same params but with mode=check_authentication
    const verifyParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      verifyParams.set(key, value)
    }
    verifyParams.set('openid.mode', 'check_authentication')

    const res = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyParams.toString(),
    })
    const text = await res.text()

    if (!text.includes('is_valid:true')) return null

    // Extract SteamID from claimed_id: https://steamcommunity.com/openid/id/76561198012345678
    const claimedId = params['openid.claimed_id'] ?? ''
    const match = claimedId.match(/\/id\/(\d+)$/)
    return match?.[1] ?? null
  }

  /** Fetch a user's owned games from the Steam Web API. */
  async getOwnedGames(steamId: string): Promise<SteamOwnedGame[]> {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${this.apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Steam API error: ${res.status}`)
    const data = (await res.json()) as { response?: { games?: SteamOwnedGame[] } }
    return data.response?.games ?? []
  }

  /** Fetch a Steam user's profile summary (display name, avatar). */
  async getPlayerSummary(steamId: string): Promise<SteamPlayerSummary | null> {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${this.apiKey}&steamids=${steamId}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { response?: { players?: SteamPlayerSummary[] } }
    return data.response?.players?.[0] ?? null
  }
}
