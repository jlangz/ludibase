export interface GfnGame {
  title: string
  steamUrl?: string
  store?: string
}

const GFN_JSON_URL = 'https://static.nvidiagrid.net/supported-public-game-list/locales/gfnpc-en-US.json'

interface GfnApiEntry {
  title: string
  steamUrl?: string
  store?: string
  status?: string
}

export async function fetchGeforceNowCatalog(): Promise<GfnGame[]> {
  const res = await fetch(GFN_JSON_URL)
  if (!res.ok) {
    throw new Error(`GeForce NOW fetch failed: ${res.status} ${res.statusText}`)
  }

  const data: GfnApiEntry[] = await res.json()

  return data
    .filter((g) => g.status === 'AVAILABLE' && g.title)
    .map((g) => ({
      title: g.title.trim(),
      steamUrl: g.steamUrl || undefined,
      store: g.store || undefined,
    }))
}

export const GEFORCE_NOW_SLUG = 'geforce-now'
export const GEFORCE_NOW_SOURCE = 'gfn-json'
