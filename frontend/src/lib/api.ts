import type { GameSearchResult, SubscriptionInfo, ServiceStats, CollectionEntry, SteamConnection, SteamImportResult } from '../types'
import { supabase } from './supabase'

const API_BASE = '/api'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${session.access_token}` }
}

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

export interface FilteredSearchParams {
  q?: string
  services?: string[]
  page?: number
  pageSize?: number
}

export interface FilteredSearchResult {
  games: GameSearchResult[]
  total: number
  page: number
  pageSize: number
}

export async function searchGamesFiltered(params: FilteredSearchParams): Promise<FilteredSearchResult> {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.services && params.services.length > 0) qs.set('services', params.services.join(','))
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))

  const res = await fetch(`${API_BASE}/games/search/filtered?${qs}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

// --- Collection APIs (authenticated) ---

export async function getCollection(page = 1, pageSize = 20, storefront?: string): Promise<{
  games: CollectionEntry[]
  total: number
  page: number
  pageSize: number
  storefronts: string[]
}> {
  const headers = await authHeaders()
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (storefront) qs.set('storefront', storefront)
  const res = await fetch(`${API_BASE}/collection?${qs}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch collection')
  return res.json()
}

export async function addToCollection(igdbId: number, platforms?: string[], storefronts?: string[]): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/collection/${igdbId}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ platforms, storefronts }),
  })
  if (!res.ok) throw new Error('Failed to add to collection')
}

export async function removeFromCollection(igdbId: number): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/collection/${igdbId}`, { method: 'DELETE', headers })
  if (!res.ok) throw new Error('Failed to remove from collection')
}

export interface CollectionCheckEntry {
  ownedPlatforms: string[] | null
  storefronts: string[] | null
}

export async function checkCollection(igdbIds: number[]): Promise<Record<number, CollectionCheckEntry | null>> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/collection/check?igdbIds=${igdbIds.join(',')}`, { headers })
  if (!res.ok) throw new Error('Failed to check collection')
  return res.json()
}

// --- Steam APIs (authenticated) ---

export async function getSteamStatus(): Promise<SteamConnection | null> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/steam/status`, { headers })
  if (!res.ok) throw new Error('Failed to fetch Steam status')
  return res.json()
}

export async function getSteamConnectUrl(): Promise<string> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/steam/connect`, { headers })
  if (!res.ok) throw new Error('Failed to get Steam connect URL')
  const data = await res.json()
  return data.url
}

export async function importSteamLibrary(): Promise<SteamImportResult> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/steam/import`, { method: 'POST', headers })
  if (!res.ok) throw new Error('Failed to import Steam library')
  return res.json()
}

export async function disconnectSteam(): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/steam/disconnect`, { method: 'DELETE', headers })
  if (!res.ok) throw new Error('Failed to disconnect Steam')
}

/**
 * Build an IGDB image URL from an image_id.
 * Sizes: thumb (90x128), cover_small (90x128), cover_big (264x374),
 *        screenshot_med (569x320), 720p (1280x720), 1080p (1920x1080)
 */
export function igdbImageUrl(imageId: string, size = 'cover_big'): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`
}
