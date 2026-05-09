import { isNull, sql, type SQL } from 'drizzle-orm'
import { games, gameSubscriptions } from '../../db/schema'

/**
 * Subscription tier hierarchy — higher tiers include access to all lower tiers.
 * E.g. a PS Plus Premium subscriber can play Extra and Essential games too.
 */
export const SERVICE_TIER_INCLUDES: Record<string, string[]> = {
  'ps-plus-premium': ['ps-plus-extra', 'ps-plus-essential'],
  'ps-plus-extra': ['ps-plus-essential'],
  'gamepass-ultimate': ['gamepass-standard', 'gamepass-core'],
  'gamepass-standard': ['gamepass-core'],
  'ea-play-pro': ['ea-play'],
  'ubisoft-plus-premium': ['ubisoft-plus'],
  'nintendo-online-expansion': ['nintendo-online'],
}

/** Expand a list of service slugs to include all lower-tier services they encompass. */
export function expandServiceTiers(slugs: string[]): string[] {
  const expanded = new Set(slugs)
  for (const slug of slugs) {
    const includes = SERVICE_TIER_INCLUDES[slug]
    if (includes) for (const s of includes) expanded.add(s)
  }
  return [...expanded]
}

export const SERVICE_FAMILIES: Record<string, { name: string; tiers: string[] }> = {
  gamepass: {
    name: 'Xbox Game Pass',
    tiers: ['gamepass-core', 'gamepass-standard', 'gamepass-ultimate'],
  },
  'ps-plus': {
    name: 'PlayStation Plus',
    tiers: ['ps-plus-essential', 'ps-plus-extra', 'ps-plus-premium'],
  },
  'geforce-now': { name: 'GeForce NOW', tiers: ['geforce-now'] },
  'ea-play': { name: 'EA Play', tiers: ['ea-play'] },
  'ubisoft-plus': {
    name: 'Ubisoft+',
    tiers: ['ubisoft-plus', 'ubisoft-plus-premium'],
  },
  'nintendo-online': {
    name: 'Nintendo Switch Online',
    tiers: ['nintendo-online', 'nintendo-online-expansion'],
  },
}

export type SortMode = 'alpha-asc' | 'alpha-desc' | 'rating-asc' | 'rating-desc'

export function buildSortClause(sort: SortMode | string): SQL {
  switch (sort) {
    case 'alpha-desc':
      return sql`${games.title} DESC`
    case 'rating-desc':
      return sql`COALESCE(${games.aggregatedRating}, 0) DESC, ${games.title} ASC`
    case 'rating-asc':
      return sql`COALESCE(${games.aggregatedRating}, 0) ASC, ${games.title} ASC`
    case 'alpha-asc':
    default:
      return sql`${games.title} ASC`
  }
}

export function buildSearchCondition(q: string): SQL | null {
  if (q.length < 2) return null
  return sql`(${games.title} % ${q} OR ${games.title} ILIKE ${'%' + q + '%'})`
}

export function buildPlatformCondition(platform: string): SQL | null {
  if (platform === 'pc') return sql`${games.platforms} @> '"PC"'::jsonb`
  if (platform === 'console') {
    return sql`(${games.platforms} @> '"Series X|S"'::jsonb OR ${games.platforms} @> '"XONE"'::jsonb)`
  }
  return null
}

/** Active-subscription filter: rows where removedAt IS NULL. */
export const activeSubscription = () => isNull(gameSubscriptions.removedAt)

/** Build a SQL `IN (...)` literal for a list of service slugs. */
export function inServiceSlugs(slugs: string[]): SQL {
  return sql`${gameSubscriptions.serviceSlug} IN (${sql.join(
    slugs.map((s) => sql`${s}`),
    sql`, `,
  )})`
}
