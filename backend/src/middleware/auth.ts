import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify } from 'jose'

export type AuthEnv = {
  Variables: { userId: string }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

/**
 * Auth middleware that verifies Supabase JWT tokens using the JWKS endpoint.
 * Uses asymmetric verification (RS256/ES256) — no shared secret needed.
 * Sets `userId` (the Supabase user UUID) on the Hono context.
 */
export function requireAuth(supabaseUrl: string) {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
    )
  }

  return createMiddleware<AuthEnv>(async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const token = authHeader.slice(7)

    try {
      const { payload } = await jwtVerify(token, jwks!, {
        issuer: `${supabaseUrl}/auth/v1`,
        audience: 'authenticated',
        algorithms: ['RS256', 'ES256'],
      })

      const userId = payload.sub
      if (!userId) {
        return c.json({ error: 'Invalid token: missing sub claim' }, 401)
      }

      c.set('userId', userId)
      await next()
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401)
    }
  })
}
