import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { SignJWT, jwtVerify } from 'jose'
import type { Database } from '../db/index.js'
import type { Config } from '../config.js'
import { steamConnections } from '../db/schema.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import { SteamService } from '../services/steam.js'
import { SteamImporter } from '../services/steam-importer.js'

export function steamRoutes(db: Database, config: Config) {
  const steam = new SteamService(config.steamApiKey!)
  const importer = new SteamImporter(db, steam)
  const app = new Hono<AuthEnv>()
  const supabaseUrl = config.supabaseUrl!
  const stateSecret = new TextEncoder().encode(config.steamApiKey!)

  /**
   * GET /steam/connect
   * Returns the Steam OpenID redirect URL. Requires auth.
   */
  app.get('/steam/connect', requireAuth(supabaseUrl), async (c) => {
    const userId = c.get('userId')

    const state = await new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .sign(stateSecret)

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
    let userId: string
    try {
      const { payload } = await jwtVerify(state, stateSecret, { algorithms: ['HS256'] })
      if (!payload.sub) return c.text('Invalid state token', 401)
      userId = payload.sub
    } catch {
      return c.text('Invalid or expired state', 401)
    }

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

    return c.redirect(`${config.frontendUrl}/profile?steam=connected`)
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
