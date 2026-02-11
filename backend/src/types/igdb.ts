// Raw IGDB API response types

export interface IgdbGame {
  id: number
  name: string
  slug?: string
  summary?: string
  first_release_date?: number // Unix timestamp
  url?: string
  cover?: IgdbCover
  platforms?: IgdbPlatform[]
  genres?: IgdbGenre[]
  involved_companies?: IgdbInvolvedCompany[]
  category?: number
  aggregated_rating?: number
  aggregated_rating_count?: number
  updated_at?: number // IGDB's own updated_at Unix timestamp
}

export interface IgdbCover {
  id: number
  image_id: string
}

export interface IgdbPlatform {
  id: number
  name: string
  abbreviation?: string
}

export interface IgdbGenre {
  id: number
  name: string
}

export interface IgdbInvolvedCompany {
  id: number
  company: {
    id: number
    name: string
  }
  developer: boolean
  publisher: boolean
}

// Our simplified response shape for the search endpoint
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
  firstReleaseDate: string | null // ISO date string
  igdbUrl: string | null
  igdbUpdatedAt: number | null
}
