export interface Profile {
  id: string
  username: string | null
  bio: string | null
  avatar_url: string | null
  platforms: string[] | null
  subscriptions: string[] | null
  created_at: string
  updated_at: string
}

export interface GameSearchResult {
  igdbId: number
  title: string
  slug: string | null
  summary: string | null
  coverImageId: string | null
  platforms: string[]
  genres: string[]
  category: number | null
  developer: string | null
  publisher: string | null
  aggregatedRating: number | null
  ratingCount: number | null
  firstReleaseDate: string | null
  igdbUrl: string | null
  igdbUpdatedAt: number | null
}

export interface SubscriptionInfo {
  service: string
  source: string
  addedAt: string
}

export interface ServiceStats {
  slug: string
  count: number
}

export interface CollectionEntry {
  igdbId: number
  title: string
  slug: string | null
  coverImageId: string | null
  platforms: string[]
  genres: string[]
  developer: string | null
  publisher: string | null
  aggregatedRating: number | null
  firstReleaseDate: string | null
  source: 'manual' | 'steam'
  ownedPlatforms: string[] | null
  storefronts: string[] | null
  steamAppId: number | null
  steamPlaytimeMinutes: number | null
  addedAt: string
}

export interface SteamConnection {
  steamId: string
  steamUsername: string | null
  steamAvatarUrl: string | null
  connectedAt: string
  lastImportAt: string | null
}

export interface SteamImportResult {
  total: number
  matched: number
  unmatched: number
  imported: number
}
