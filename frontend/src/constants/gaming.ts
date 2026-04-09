/** Gaming platforms — values use IGDB abbreviation format for system-wide consistency */
export const PLATFORMS = [
  { value: 'PC', label: 'PC (Windows)' },
  { value: 'Mac', label: 'Mac' },
  { value: 'Linux', label: 'Linux' },
  { value: 'PS5', label: 'PlayStation 5' },
  { value: 'PS4', label: 'PlayStation 4' },
  { value: 'Series X|S', label: 'Xbox Series X|S' },
  { value: 'XONE', label: 'Xbox One' },
  { value: 'Switch', label: 'Nintendo Switch' },
  { value: 'Switch 2', label: 'Nintendo Switch 2' },
  { value: 'Android', label: 'Android' },
  { value: 'iOS', label: 'iOS' },
] as const

/** Subscription services — slugs are the system-wide standard, will map to future `services` table */
export const SUBSCRIPTION_SERVICES = [
  { value: 'gamepass-core', label: 'Xbox Game Pass Core' },
  { value: 'gamepass-standard', label: 'Xbox Game Pass Standard' },
  { value: 'gamepass-ultimate', label: 'Xbox Game Pass Ultimate' },
  { value: 'ps-plus-essential', label: 'PS Plus Essential' },
  { value: 'ps-plus-extra', label: 'PS Plus Extra' },
  { value: 'ps-plus-premium', label: 'PS Plus Premium' },
  { value: 'ea-play', label: 'EA Play' },
  { value: 'ea-play-pro', label: 'EA Play Pro' },
  { value: 'ubisoft-plus', label: 'Ubisoft+ Classics' },
  { value: 'ubisoft-plus-premium', label: 'Ubisoft+ Premium' },
  { value: 'nintendo-online', label: 'Nintendo Switch Online' },
  { value: 'nintendo-online-expansion', label: 'Nintendo Switch Online + Expansion Pack' },
  { value: 'humble-choice', label: 'Humble Choice' },
  { value: 'geforce-now', label: 'GeForce NOW' },
  { value: 'amazon-luna', label: 'Amazon Luna' },
] as const

/**
 * Subscription tier hierarchy — higher tiers include all lower tiers.
 * Used for: auto-selecting lower tiers in profile, collapsing tabs in collection page,
 * and expanding filters in search.
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

/** Expand a list of service slugs to include all lower-tier services. */
export function expandServiceTiers(services: string[]): string[] {
  const expanded = new Set(services)
  for (const slug of services) {
    const includes = SERVICE_TIER_INCLUDES[slug]
    if (includes) {
      for (const s of includes) expanded.add(s)
    }
  }
  return [...expanded]
}

/** Collapse a list of service slugs to only the highest tier per family. */
export function collapseToHighestTiers(services: string[]): string[] {
  const set = new Set(services)
  // Remove any service that is included by a higher tier also in the set
  for (const slug of services) {
    const includes = SERVICE_TIER_INCLUDES[slug]
    if (includes) {
      for (const lower of includes) set.delete(lower)
    }
  }
  return [...set]
}

/** Service families with tier metadata for dedicated service pages */
export const SERVICE_FAMILIES: Record<string, {
  name: string
  tiers: { slug: string; label: string; bg: string; text: string }[]
  platformFilter: boolean
}> = {
  gamepass: {
    name: 'Xbox Game Pass',
    tiers: [
      { slug: 'gamepass-core', label: 'Core', bg: 'bg-gray-700/50', text: 'text-gray-300' },
      { slug: 'gamepass-standard', label: 'Standard', bg: 'bg-green-900/50', text: 'text-green-400' },
      { slug: 'gamepass-ultimate', label: 'Ultimate', bg: 'bg-purple-900/50', text: 'text-purple-400' },
    ],
    platformFilter: true,
  },
  'ps-plus': {
    name: 'PlayStation Plus',
    tiers: [
      { slug: 'ps-plus-essential', label: 'Essential', bg: 'bg-blue-900/50', text: 'text-blue-400' },
      { slug: 'ps-plus-extra', label: 'Extra', bg: 'bg-purple-900/50', text: 'text-purple-400' },
      { slug: 'ps-plus-premium', label: 'Premium', bg: 'bg-yellow-900/50', text: 'text-yellow-400' },
    ],
    platformFilter: false,
  },
  'geforce-now': {
    name: 'GeForce NOW',
    tiers: [
      { slug: 'geforce-now', label: 'GeForce NOW', bg: 'bg-green-900/50', text: 'text-green-400' },
    ],
    platformFilter: false,
  },
  'ea-play': {
    name: 'EA Play',
    tiers: [
      { slug: 'ea-play', label: 'EA Play', bg: 'bg-blue-900/50', text: 'text-blue-400' },
    ],
    platformFilter: false,
  },
  'ubisoft-plus': {
    name: 'Ubisoft+',
    tiers: [
      { slug: 'ubisoft-plus', label: 'Classics', bg: 'bg-blue-900/50', text: 'text-blue-400' },
      { slug: 'ubisoft-plus-premium', label: 'Premium', bg: 'bg-purple-900/50', text: 'text-purple-400' },
    ],
    platformFilter: false,
  },
  'nintendo-online': {
    name: 'Nintendo Switch Online',
    tiers: [
      { slug: 'nintendo-online', label: 'Basic', bg: 'bg-red-900/50', text: 'text-red-400' },
      { slug: 'nintendo-online-expansion', label: 'Expansion Pack', bg: 'bg-red-800/50', text: 'text-red-300' },
    ],
    platformFilter: false,
  },
}

/** Digital storefronts where games can be purchased/owned */
export const STOREFRONTS = [
  { value: 'steam', label: 'Steam' },
  { value: 'epic', label: 'Epic Games Store' },
  { value: 'gog', label: 'GOG' },
  { value: 'xbox', label: 'Xbox / Microsoft Store' },
  { value: 'playstation', label: 'PlayStation Store' },
  { value: 'nintendo', label: 'Nintendo eShop' },
  { value: 'ea-app', label: 'EA App' },
  { value: 'ubisoft', label: 'Ubisoft Connect' },
  { value: 'battle-net', label: 'Battle.net' },
  { value: 'physical', label: 'Physical' },
] as const
