// Raw IGDB API response types

export interface IgdbGame {
  id: number
  name: string
  summary?: string
  first_release_date?: number // Unix timestamp
  url?: string
  cover?: IgdbCover
  platforms?: IgdbPlatform[]
  genres?: IgdbGenre[]
  involved_companies?: IgdbInvolvedCompany[]
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
  summary: string | null
  coverImageId: string | null
  platforms: string[]
  genres: string[]
  firstReleaseDate: string | null // ISO date string
  igdbUrl: string | null
}
