import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchGamesFiltered, checkSubscriptions, igdbImageUrl } from '../lib/api'
import { useProfile } from '../hooks/useProfile'
import { SUBSCRIPTION_SERVICES } from '../constants/gaming'
import type { GameSearchResult } from '../types'

const serviceLabels = Object.fromEntries(
  SUBSCRIPTION_SERVICES.map((s) => [s.value, s.label])
)

const PAGE_SIZE = 20

export function SearchPage() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const { profile } = useProfile()
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Debounce search input
  useEffect(() => {
    clearTimeout(timeoutRef.current)
    const trimmed = input.trim()
    timeoutRef.current = setTimeout(() => {
      setQuery(trimmed)
      setPage(1)
    }, trimmed.length < 2 ? 0 : 300)
    return () => clearTimeout(timeoutRef.current)
  }, [input])

  const hasFilters = query.length >= 2 || selectedServices.length > 0

  const { data, isLoading } = useQuery({
    queryKey: ['filteredSearch', query, selectedServices, page],
    queryFn: () =>
      searchGamesFiltered({
        q: query.length >= 2 ? query : undefined,
        services: selectedServices.length > 0 ? selectedServices : undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: hasFilters,
    staleTime: 60_000,
  })

  const results = data?.games ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Batch-check subscription info for result games
  const igdbIds = results.map((g) => g.igdbId)
  const { data: subsMap = {} } = useQuery({
    queryKey: ['subsCheck', 'search', igdbIds.join(',')],
    queryFn: () => checkSubscriptions(igdbIds),
    enabled: igdbIds.length > 0,
  })

  function toggleService(slug: string) {
    setSelectedServices((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
    setPage(1)
  }

  function applyMyServices() {
    if (profile?.subscriptions && profile.subscriptions.length > 0) {
      setSelectedServices(profile.subscriptions)
      setPage(1)
    }
  }

  function clearFilters() {
    setSelectedServices([])
    setPage(1)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Search Games</h1>

      {/* Search input */}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search by game name..."
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />

      {/* Service filters */}
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-400">Filter by service</span>
          {profile?.subscriptions && profile.subscriptions.length > 0 && (
            <button
              onClick={applyMyServices}
              className="rounded-full bg-purple-900/40 px-3 py-1 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-900/60"
            >
              My Services
            </button>
          )}
          {selectedServices.length > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {SUBSCRIPTION_SERVICES.map((svc) => (
            <button
              key={svc.value}
              onClick={() => toggleService(svc.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                selectedServices.includes(svc.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
              }`}
            >
              {svc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="mt-6">
        {!hasFilters && (
          <p className="py-12 text-center text-gray-500">
            Type a game name or select a service to start searching
          </p>
        )}

        {hasFilters && isLoading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500" />
          </div>
        )}

        {hasFilters && !isLoading && results.length === 0 && (
          <p className="py-12 text-center text-gray-500">
            No games found{query ? ` for "${query}"` : ''}{selectedServices.length > 0 ? ' with selected services' : ''}
          </p>
        )}

        {results.length > 0 && (
          <>
            <div className="mb-3 text-sm text-gray-500">
              {total} game{total !== 1 ? 's' : ''} found
            </div>

            <div className="space-y-2">
              {results.map((game) => (
                <GameRow
                  key={game.igdbId}
                  game={game}
                  services={subsMap[game.igdbId] ?? []}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded border border-gray-700 px-3 py-1.5 text-sm disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="px-3 text-sm text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded border border-gray-700 px-3 py-1.5 text-sm disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function GameRow({ game, services }: { game: GameSearchResult; services: string[] }) {
  return (
    <Link
      to={`/game/${game.igdbId}`}
      className="flex gap-4 rounded border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-600"
    >
      {game.coverImageId ? (
        <img
          src={igdbImageUrl(game.coverImageId, 'cover_small')}
          alt={game.title}
          className="h-24 w-[68px] shrink-0 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-24 w-[68px] shrink-0 items-center justify-center rounded bg-gray-800 text-xs text-gray-600">
          No image
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">{game.title}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {game.aggregatedRating != null && (
              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                game.aggregatedRating >= 75
                  ? 'bg-green-900/50 text-green-400'
                  : game.aggregatedRating >= 50
                    ? 'bg-yellow-900/50 text-yellow-400'
                    : 'bg-red-900/50 text-red-400'
              }`}>
                {game.aggregatedRating}
              </span>
            )}
            {game.firstReleaseDate && (
              <span className="text-sm text-gray-500">
                {new Date(game.firstReleaseDate).getFullYear()}
              </span>
            )}
          </div>
        </div>

        {game.platforms.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {game.platforms.map((p) => (
              <span key={p} className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">
                {p}
              </span>
            ))}
          </div>
        )}

        {services.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {services.map((s) => (
              <span key={s} className="rounded bg-blue-900/40 px-1.5 py-0.5 text-xs text-blue-300">
                {serviceLabels[s] ?? s}
              </span>
            ))}
          </div>
        )}

        {game.summary && (
          <p className="mt-1.5 line-clamp-2 text-sm text-gray-400">{game.summary}</p>
        )}
      </div>
    </Link>
  )
}
