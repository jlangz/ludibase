import type { GameSearchResult, SubscriptionInfo, ServiceStats } from '../types'

const API_BASE = '/api'

export async function searchGames(query: string): Promise<GameSearchResult[]> {
  const res = await fetch(`${API_BASE}/games/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Search failed' }))
    throw new Error(body.error ?? 'Search failed')
  }
  return res.json()
}

export async function getPopularGames(limit = 20, page = 1): Promise<GameSearchResult[]> {
  const res = await fetch(`${API_BASE}/games/popular?limit=${limit}&page=${page}`)
  if (!res.ok) throw new Error('Failed to fetch popular games')
  return res.json()
}

export async function getGameSubscriptions(igdbId: number): Promise<SubscriptionInfo[]> {
  const res = await fetch(`${API_BASE}/games/${igdbId}/subscriptions`)
  if (!res.ok) throw new Error('Failed to fetch subscriptions')
  const data = await res.json()
  return data.subscriptions
}

export async function checkSubscriptions(igdbIds: number[]): Promise<Record<number, string[]>> {
  const res = await fetch(`${API_BASE}/subscriptions/check?igdbIds=${igdbIds.join(',')}`)
  if (!res.ok) throw new Error('Failed to check subscriptions')
  return res.json()
}

export async function getSubscriptionStats(): Promise<ServiceStats[]> {
  const res = await fetch(`${API_BASE}/subscriptions/stats`)
  if (!res.ok) throw new Error('Failed to fetch stats')
  const data = await res.json()
  return data.services
}

export async function getServiceGames(slug: string, page = 1, pageSize = 20): Promise<{
  games: GameSearchResult[]
  total: number
  page: number
  pageSize: number
}> {
  const res = await fetch(`${API_BASE}/subscriptions/service/${slug}?page=${page}&pageSize=${pageSize}`)
  if (!res.ok) throw new Error('Failed to fetch service games')
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
