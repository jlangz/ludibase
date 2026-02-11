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
