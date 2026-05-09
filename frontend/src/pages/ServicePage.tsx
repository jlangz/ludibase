import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getServiceFamily, igdbImageUrl } from '../lib/api'
import { SERVICE_FAMILIES } from '../constants/gaming'
import { Search, ArrowUpDown } from 'lucide-react'
import type { GameSearchResult } from '../types'

const SORT_OPTIONS = [
  { value: 'alpha-asc', label: 'A → Z' },
  { value: 'alpha-desc', label: 'Z → A' },
  { value: 'rating-desc', label: 'Highest Rated' },
  { value: 'rating-asc', label: 'Lowest Rated' },
] as const

const PAGE_SIZE = 30

export function ServicePage() {
  const { family: familyKey } = useParams<{ family: string }>()
  const family = familyKey ? SERVICE_FAMILIES[familyKey] : undefined

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('alpha-asc')
  const [platform, setPlatform] = useState('')
  const [activeTier, setActiveTier] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Debounce search
  useEffect(() => {
    clearTimeout(timeoutRef.current)
    const trimmed = searchInput.trim()
    const delay = trimmed.length < 2 ? 0 : 300
    timeoutRef.current = setTimeout(() => { setQuery(trimmed.length >= 2 ? trimmed : ''); setPage(1) }, delay)
    return () => clearTimeout(timeoutRef.current)
  }, [searchInput])

  const { data, isLoading } = useQuery({
    queryKey: ['serviceFamily', familyKey, query, sort, platform, activeTier, page],
    queryFn: () => getServiceFamily({
      family: familyKey!,
      q: query || undefined,
      sort,
      platform: platform || undefined,
      tier: activeTier || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    enabled: !!familyKey && !!family,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })

  if (!family) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-gray-400">Service not found</p>
        <Link to="/" className="mt-4 inline-block text-sm text-blue-400 hover:underline">Back to home</Link>
      </div>
    )
  }

  const games = data?.games ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const tierCounts = data?.tierCounts ?? {}
  const tierExclusive = data?.tierExclusive ?? {}
  const tierLookup = Object.fromEntries(family.tiers.map((t) => [t.slug, t]))

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link to="/" className="mb-2 inline-block text-sm text-gray-500 hover:text-gray-300">← Home</Link>
        <h1 className="text-3xl font-bold">{family.name}</h1>
        <p className="mt-1 text-sm text-gray-500">{total} games total</p>
        {family.tiers.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {family.tiers.map((tier, i) => (
              <span key={tier.slug} className="text-sm text-gray-400">
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${tier.bg} ${tier.text}`}>
                  {tier.label}
                </span>
                {' '}{tierCounts[tier.slug] ?? 0} games
                {i > 0 && tierExclusive[tier.slug] != null && (
                  <span className="text-xs text-gray-500"> (+{tierExclusive[tier.slug]} exclusive)</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tier filter chips — hidden for single-tier families */}
      {family.tiers.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => { setActiveTier(''); setPage(1) }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              !activeTier ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All Tiers
          </button>
          {family.tiers.map((tier) => (
            <button
              key={tier.slug}
              onClick={() => { setActiveTier(tier.slug); setPage(1) }}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                activeTier === tier.slug
                  ? `${tier.bg} ${tier.text} ring-1 ring-current`
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tier.label}
              <span className="ml-1.5 text-xs opacity-60">{tierCounts[tier.slug] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search + Sort + Platform filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={`Search ${family.name}...`}
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

        {family.platformFilter && (
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

      {/* Results count */}
      {!isLoading && total > 0 && (
        <p className="mb-3 text-sm text-gray-500">{total} game{total !== 1 ? 's' : ''}</p>
      )}

      {/* Game grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg bg-gray-800" style={{ aspectRatio: '3/4' }} />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">
            {query ? `No results for "${query}"` : 'No games found'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {games.map((game) => (
              <ServiceGameTile key={game.igdbId} game={game} tierLookup={tierLookup} />
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
    </div>
  )
}

function ServiceGameTile({
  game,
  tierLookup,
}: {
  game: GameSearchResult & { tiers: string[] }
  tierLookup: Record<string, { slug: string; label: string; bg: string; text: string }>
}) {
  return (
    <Link
      to={`/game/${game.igdbId}`}
      className="group overflow-hidden rounded-lg border border-gray-800 bg-gray-900 transition-colors hover:border-gray-600"
    >
      {game.coverImageId ? (
        <img src={igdbImageUrl(game.coverImageId, 'cover_big')} alt={game.title} className="aspect-3/4 w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex aspect-3/4 w-full items-center justify-center bg-gray-800 text-xs text-gray-600">No image</div>
      )}
      <div className="p-2">
        <p className="line-clamp-2 text-sm font-medium leading-tight">{game.title}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {game.tiers.map((tierSlug) => {
            const tier = tierLookup[tierSlug]
            if (!tier) return null
            return (
              <span key={tierSlug} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tier.bg} ${tier.text}`}>
                {tier.label}
              </span>
            )
          })}
        </div>
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
