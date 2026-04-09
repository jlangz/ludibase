import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import type { Config } from '../config.js'
import { steamConnections } from '../db/schema.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import type { SteamService } from '../services/steam.js'
import type { SteamImporter } from '../services/steam-importer.js'

export function steamRoutes(
  db: Database,
  steam: SteamService,
  importer: SteamImporter,
  config: Config,
) {
  const app = new Hono<AuthEnv>()
  const supabaseUrl = config.supabaseUrl!
  // Use Steam API key as HMAC secret for state tokens (it's a server-side secret)
  const stateSecret = config.steamApiKey!

  /**
   * GET /steam/connect
   * Returns the Steam OpenID redirect URL. Requires auth.
   */
  app.get('/steam/connect', requireAuth(supabaseUrl), async (c) => {
    const userId = c.get('userId')

    // Create a signed state token containing the user ID
    const state = await signState(userId, stateSecret)
    const callbackUrl = `${config.publicUrl}/steam/callback?state=${encodeURIComponent(state)}`
    const url = steam.getLoginUrl(callbackUrl)

    return c.json({ url })
  })

  /**
   * GET /steam/callback
   * Handles the Steam OpenID redirect. No auth middleware — uses signed state token.
   * Redirects the browser to the frontend after saving the connection.
   */
  app.get('/steam/callback', async (c) => {
    const state = c.req.query('state')
    if (!state) return c.text('Missing state parameter', 400)

    // Verify state token to get userId
    const userId = await verifyState(state, stateSecret)
    if (!userId) return c.text('Invalid or expired state', 401)

    // Collect all openid.* params
    const params: Record<string, string> = {}
    for (const [key, value] of Object.entries(c.req.query())) {
      if (key.startsWith('openid.') && typeof value === 'string') {
        params[key] = value
      }
    }

    // Verify with Steam and extract SteamID
    const steamId = await steam.verifyCallback(params)
    if (!steamId) return c.text('Steam verification failed', 401)

    // Fetch Steam profile info
    const profile = await steam.getPlayerSummary(steamId)

    // Upsert steam connection
    await db
      .insert(steamConnections)
      .values({
        userId,
        steamId,
        steamUsername: profile?.personaname ?? null,
        steamAvatarUrl: profile?.avatarfull ?? null,
      })
      .onConflictDoUpdate({
        target: steamConnections.userId,
        set: {
          steamId,
          steamUsername: profile?.personaname ?? null,
          steamAvatarUrl: profile?.avatarfull ?? null,
          connectedAt: new Date(),
        },
      })

    // Redirect to frontend profile page
    const frontendUrl = config.publicUrl.includes(':8080')
      ? config.publicUrl.replace(':8080', ':5173')
      : config.publicUrl
    return c.redirect(`${frontendUrl}/profile?steam=connected`)
  })

  /**
   * GET /steam/status
   * Returns the current user's Steam connection info.
   */
  app.get('/steam/status', requireAuth(supabaseUrl), async (c) => {
    const userId = c.get('userId')

    const [connection] = await db
      .select()
      .from(steamConnections)
      .where(eq(steamConnections.userId, userId))
      .limit(1)

    if (!connection) return c.json(null)

    return c.json({
      steamId: connection.steamId,
      steamUsername: connection.steamUsername,
      steamAvatarUrl: connection.steamAvatarUrl,
      connectedAt: connection.connectedAt.toISOString(),
      lastImportAt: connection.lastImportAt?.toISOString() ?? null,
    })
  })

  /**
   * POST /steam/import
   * Trigger a Steam library import for the authenticated user.
   */
  app.post('/steam/import', requireAuth(supabaseUrl), async (c) => {
    const userId = c.get('userId')

    const [connection] = await db
      .select()
      .from(steamConnections)
      .where(eq(steamConnections.userId, userId))
      .limit(1)

    if (!connection) {
      return c.json({ error: 'No Steam account connected' }, 400)
    }

    try {
      const result = await importer.importLibrary(userId, connection.steamId)
      return c.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      console.error('[Steam] Import error:', message)
      return c.json({ error: message }, 500)
    }
  })

  /**
   * DELETE /steam/disconnect
   * Remove the Steam connection (keeps imported collection games).
   */
  app.delete('/steam/disconnect', requireAuth(supabaseUrl), async (c) => {
    const userId = c.get('userId')

    await db
      .delete(steamConnections)
      .where(eq(steamConnections.userId, userId))

    return c.json({ success: true })
  })

  return app
}

/** Create a short-lived signed state token containing a user ID. */
async function signState(userId: string, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const payload = btoa(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 600 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`))
  let binary = ''
  for (const byte of new Uint8Array(sig)) binary += String.fromCharCode(byte)
  const sigB64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  return `${header}.${payload}.${sigB64}`
}

/** Verify a state token and return the user ID, or null if invalid/expired. */
async function verifyState(token: string, secret: string): Promise<string | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, sigB64] = parts

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const sig = await crypto.subtle.sign('HMAC', key, data)
    let binary = ''
    for (const byte of new Uint8Array(sig)) binary += String.fromCharCode(byte)
    const expectedSig = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    if (expectedSig !== sigB64) return null

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload.sub ?? null
  } catch {
    return null
  }
}
