import { createMiddleware } from 'hono/factory'

/**
 * Simple admin key middleware for protecting management endpoints.
 * Checks for `x-admin-key` header matching the ADMIN_KEY env var.
 * If ADMIN_KEY is not set, blocks all requests (fail-closed).
 */
export function requireAdmin() {
  return createMiddleware(async (c, next) => {
    const adminKey = process.env.ADMIN_KEY
    if (!adminKey) {
      return c.json({ error: 'Admin endpoints disabled (ADMIN_KEY not configured)' }, 403)
    }

    const provided = c.req.header('x-admin-key')
    if (provided !== adminKey) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    await next()
  })
}
