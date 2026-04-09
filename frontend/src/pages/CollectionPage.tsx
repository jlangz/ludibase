import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useCollection } from '../hooks/useCollection'
import { useSteamConnection } from '../hooks/useSteamConnection'
import { igdbImageUrl, getSubscriptionGames, getAllMyGames } from '../lib/api'
import { STOREFRONTS, SUBSCRIPTION_SERVICES, collapseToHighestTiers } from '../constants/gaming'
import { Library, Download, Loader2, CheckCircle, AlertCircle, X, Search, ArrowUpDown } from 'lucide-react'
import type { GameSearchResult, SteamImportResult } from '../types'

const storefrontLabels = Object.fromEntries(STOREFRONTS.map((s) => [s.value, s.label]))
const serviceLabels = Object.fromEntries(SUBSCRIPTION_SERVICES.map((s) => [s.value, s.label]))

const SORT_OPTIONS = [
  { value: 'alpha-asc', label: 'A → Z' },
  { value: 'alpha-desc', label: 'Z → A' },
  { value: 'rating-desc', label: 'Highest Rated' },
  { value: 'rating-asc', label: 'Lowest Rated' },
] as const

type TabMode = { type: 'all' } | { type: 'owned'; storefront?: string } | { type: 'sub'; service?: string; overlap: boolean }

export function CollectionPage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const steam = useSteamConnection()

  const [tab, setTab] = useState<TabMode>({ type: 'all' })
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('alpha-asc')
  const [platform, setPlatform] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Debounce search
  useEffect(() => {
    clearTimeout(timeoutRef.current)
    const trimmed = searchInput.trim()
    const delay = trimmed.length < 2 ? 0 : 300
    timeoutRef.current = setTimeout(() => { setQuery(trimmed.length >= 2 ? trimmed : ''); setPage(1) }, delay)
    return () => clearTimeout(timeoutRef.current)
  }, [searchInput])

  const isAllTab = tab.type === 'all'
  const isSubTab = tab.type === 'sub'
  const isOwnedTab = tab.type === 'owned'
  const ownedStorefront = isOwnedTab ? tab.storefront : undefined
  const subService = isSubTab ? tab.service : undefined
  const subOverlap = isSubTab ? tab.overlap : false

  const sharedParams = { q: query || undefined, sort, platform: platform || undefined }

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ['allMyGames', query, sort, platform, page],
    queryFn: () => getAllMyGames({ page, pageSize: 20, ...sharedParams }),
    enabled: !!user && isAllTab,
    staleTime: 60_000,
  })

  const { data: collectionData, isLoading: collectionLoading } = useCollection({
    page,
    storefront: ownedStorefront,
    ...sharedParams,
  })

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['subscriptionGames', subService, subOverlap, query, sort, platform, page],
    queryFn: () => getSubscriptionGames({
      service: subService,
      overlap: subOverlap,
      page,
      pageSize: 20,
      ...sharedParams,
    }),
    enabled: !!user && isSubTab,
    staleTime: 60_000,
  })

  if (!user) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-gray-400">Sign in to view your game collection</p>
        <Link to="/login" className="mt-4 inline-block text-sm text-blue-400 hover:underline">Log In</Link>
      </div>
    )
  }

  const data = isAllTab ? allData : isSubTab ? subData : collectionData
  const isLoading = isAllTab ? allLoading : isSubTab ? subLoading : collectionLoading
  const games: GameSearchResult[] = (data?.games ?? []) as GameSearchResult[]
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

  const userStorefronts = collectionData?.storefronts ?? []
  const userSubs = collapseToHighestTiers(profile?.subscriptions ?? [])
  const isGamePassTab = isSubTab && subService?.startsWith('gamepass-')

  const showSteamImport = steam.isConnected && (
    isAllTab ||
    (isOwnedTab && tab.storefront === undefined) ||
    (isOwnedTab && tab.storefront === 'steam')
  )

  function switchTab(newTab: TabMode) {
    setTab(newTab)
    setPage(1)
    setPlatform('')
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Library className="h-6 w-6" />
          My Games
        </h1>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="text-sm text-gray-500">{total} game{total !== 1 ? 's' : ''}</span>
          )}
          {showSteamImport && (
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Import from Steam
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          <TabButton active={isAllTab} onClick={() => switchTab({ type: 'all' })}>
            All Games
          </TabButton>
          <TabButton active={isOwnedTab && !tab.storefront} onClick={() => switchTab({ type: 'owned' })}>
            All Owned
          </TabButton>
          {userStorefronts.map((sf) => (
            <TabButton key={sf} active={isOwnedTab && tab.storefront === sf} onClick={() => switchTab({ type: 'owned', storefront: sf })}>
              {storefrontLabels[sf] ?? sf}
            </TabButton>
          ))}
        </div>

        {userSubs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {userSubs.length > 1 && (
              <TabButton active={isSubTab && !subService && !subOverlap} onClick={() => switchTab({ type: 'sub', overlap: false })} variant="sub-all">
                All Subscriptions
              </TabButton>
            )}
            {userSubs.map((svc) => (
              <TabButton key={svc} active={isSubTab && subService === svc && !subOverlap} onClick={() => switchTab({ type: 'sub', service: svc, overlap: false })} variant="sub">
                {serviceLabels[svc] ?? svc}
              </TabButton>
            ))}
          </div>
        )}

        {isSubTab && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab({ ...tab, overlap: !tab.overlap } as TabMode)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                tab.overlap ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.overlap ? 'Showing overlap only' : 'Show overlap'}
            </button>
            <span className="text-xs text-gray-500">Games you own that are also in this subscription</span>
          </div>
        )}
      </div>

      {/* Search + Sort + Platform filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search in this view..."
            className="w-full rounded border border-gray-700 bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-4 w-4 text-gray-500" />
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1) }}
            className="rounded border border-gray-700 bg-gray-800 px-2 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {isGamePassTab && (
          <div className="flex gap-1.5">
            {[
              { value: '', label: 'All' },
              { value: 'pc', label: 'PC' },
              { value: 'console', label: 'Console' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setPlatform(opt.value); setPage(1) }}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  platform === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Game grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg bg-gray-800" style={{ aspectRatio: '3/4' }} />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">
            {query
              ? `No results for "${query}"`
              : isSubTab
                ? tab.overlap ? 'No overlap found' : 'No subscription games found'
                : 'No games in your collection yet'}
          </p>
          {!isSubTab && !query && (
            <div className="mt-4 flex justify-center gap-3">
              <Link to="/search" className="text-sm text-blue-400 hover:underline">Search for games</Link>
              {steam.isConnected ? (
                <button onClick={() => setShowImportModal(true)} className="text-sm text-blue-400 hover:underline">Import from Steam</button>
              ) : (
                <Link to="/profile" className="text-sm text-blue-400 hover:underline">Connect Steam</Link>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {games.map((game) => (
              <GameTile key={game.igdbId} game={game} isSubTab={isSubTab} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border border-gray-700 px-3 py-1.5 text-sm disabled:opacity-30">Previous</button>
              <span className="px-3 text-sm text-gray-400">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded border border-gray-700 px-3 py-1.5 text-sm disabled:opacity-30">Next</button>
            </div>
          )}
        </>
      )}

      {showImportModal && <SteamImportModal steam={steam} onClose={() => setShowImportModal(false)} />}
    </div>
  )
}

/* ---------- Shared components ---------- */

function TabButton({ active, onClick, variant = 'default', children }: {
  active: boolean; onClick: () => void; variant?: 'default' | 'sub' | 'sub-all'; children: React.ReactNode
}) {
  const base = 'rounded-full px-3 py-1 text-sm font-medium transition-colors'
  const styles = {
    default: active ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700',
    sub: active ? 'bg-purple-600 text-white' : 'border border-purple-800 bg-purple-900/20 text-purple-400 hover:bg-purple-900/40',
    'sub-all': active ? 'bg-purple-500 text-white' : 'border border-purple-700 bg-purple-900/30 text-purple-300 hover:bg-purple-900/50',
  }
  return <button onClick={onClick} className={`${base} ${styles[variant]}`}>{children}</button>
}

function GameTile({ game, isSubTab }: { game: GameSearchResult; isSubTab: boolean }) {
  return (
    <Link
      to={`/game/${game.igdbId}`}
      className={`group overflow-hidden rounded-lg border bg-gray-900 transition-colors hover:border-gray-600 ${isSubTab ? 'border-purple-900/50' : 'border-gray-800'}`}
    >
      {game.coverImageId ? (
        <img src={igdbImageUrl(game.coverImageId, 'cover_big')} alt={game.title} className="aspect-3/4 w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex aspect-3/4 w-full items-center justify-center bg-gray-800 text-xs text-gray-600">No image</div>
      )}
      <div className="p-2">
        <p className="line-clamp-2 text-sm font-medium leading-tight">{game.title}</p>
        {game.aggregatedRating != null && (
          <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            game.aggregatedRating >= 75 ? 'bg-green-900/50 text-green-400'
            : game.aggregatedRating >= 50 ? 'bg-yellow-900/50 text-yellow-400'
            : 'bg-red-900/50 text-red-400'
          }`}>
            {game.aggregatedRating}
          </span>
        )}
      </div>
    </Link>
  )
}

function SteamImportModal({ steam, onClose }: { steam: ReturnType<typeof useSteamConnection>; onClose: () => void }) {
  const [status, setStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<SteamImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleImport() {
    setStatus('importing'); setError(null)
    try { const res = await steam.importLibrary(); setResult(res); setStatus('success') }
    catch (err) { setError(err instanceof Error ? err.message : 'Import failed'); setStatus('error') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(e) => { if (e.target === e.currentTarget && status !== 'importing') onClose() }}>
      <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <h2 className="text-lg font-semibold">Import Steam Library</h2>
          {status !== 'importing' && <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"><X className="h-5 w-5" /></button>}
        </div>
        <div className="px-5 py-6">
          {status === 'idle' && (
            <div className="text-center">
              <p className="text-sm text-gray-400">Import your Steam game library and match games to our database.</p>
              <p className="mt-2 text-xs text-gray-500">Connected as {steam.connection?.steamUsername ?? 'Steam user'}</p>
              <button onClick={handleImport} className="mt-5 flex w-full items-center justify-center gap-2 rounded bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"><Download className="h-4 w-4" /> Start Import</button>
            </div>
          )}
          {status === 'importing' && (
            <div className="flex flex-col items-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="mt-3 text-sm text-gray-400">Importing your Steam library...</p>
              <p className="mt-1 text-xs text-gray-500">This may take a minute for large libraries</p>
            </div>
          )}
          {status === 'success' && result && (
            <div className="text-center">
              <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
              <p className="mt-3 text-lg font-medium">Import Complete</p>
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-gray-300"><span className="font-medium text-green-400">{result.matched}</span> games matched and imported</p>
                <p className="text-gray-500">{result.total} total games in your Steam library</p>
                {result.unmatched > 0 && <p className="text-gray-500">{result.unmatched} couldn't be matched</p>}
              </div>
              <button onClick={onClose} className="mt-5 w-full rounded bg-gray-800 py-2.5 text-sm font-medium hover:bg-gray-700">Done</button>
            </div>
          )}
          {status === 'error' && (
            <div className="text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
              <p className="mt-3 text-lg font-medium">Import Failed</p>
              <p className="mt-2 text-sm text-gray-400">{error}</p>
              <div className="mt-5 flex gap-2">
                <button onClick={handleImport} className="flex-1 rounded bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700">Retry</button>
                <button onClick={onClose} className="flex-1 rounded bg-gray-800 py-2.5 text-sm font-medium hover:bg-gray-700">Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
