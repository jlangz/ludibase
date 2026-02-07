export interface Profile {
  id: string
  username: string | null
  display_name: string | null
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
  summary: string | null
  coverImageId: string | null
  platforms: string[]
  genres: string[]
  firstReleaseDate: string | null
  igdbUrl: string | null
}
