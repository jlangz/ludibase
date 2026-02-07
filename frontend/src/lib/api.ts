import type { GameSearchResult } from '../types'

const API_BASE = '/api'

export async function searchGames(query: string): Promise<GameSearchResult[]> {
  const res = await fetch(`${API_BASE}/games/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Search failed' }))
    throw new Error(body.error ?? 'Search failed')
  }
  return res.json()
}

/**
 * Build an IGDB image URL from an image_id.
 * Sizes: thumb (90x128), cover_small (90x128), cover_big (264x374),
 *        screenshot_med (569x320), 720p (1280x720), 1080p (1920x1080)
 */
export function igdbImageUrl(imageId: string, size = 'cover_big'): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`
}
