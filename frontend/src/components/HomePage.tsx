import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useGameSearch } from '../hooks/useGameSearch'
import {
  getPopularGames,
  getSubscriptionStats,
  getServiceGames,
  checkSubscriptions,
  igdbImageUrl,
} from '../lib/api'
import { SUBSCRIPTION_SERVICES } from '../constants/gaming'
import { GameModal } from './GameModal'
import type { GameSearchResult } from '../types'

const serviceLabels = Object.fromEntries(
  SUBSCRIPTION_SERVICES.map((s) => [s.value, s.label])
)

export function HomePage() {
  const [selectedGame, setSelectedGame] = useState<GameSearchResult | null>(null)
  const search = useGameSearch()

  // When search is active, show search results; otherwise show landing sections
  const isSearching = search.query.length >= 2

  return (
    <div>
      {/* Search bar — always visible */}
      <div className="relative">
        <input
          type="text"
          value={search.input}
          onChange={(e) => search.setInput(e.target.value)}
          placeholder="Search for a game..."
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        {search.isLoading && (
          <div className="absolute right-3 top-3.5 text-sm text-gray-500">Searching...</div>
        )}
      </div>

      {/* Search results */}
      {isSearching ? (
        <SearchResults
          results={search.results}
          query={search.query}
          isLoading={search.isLoading}
          onSelectGame={setSelectedGame}
        />
      ) : (
        <>
          <PopularGamesSection onSelectGame={setSelectedGame} />
          <BrowseByServiceSection onSelectGame={setSelectedGame} />
        </>
      )}

      {/* Game detail modal */}
      {selectedGame && (
        <GameModal game={selectedGame} onClose={() => setSelectedGame(null)} />
      )}

      <p className="mt-8 text-xs text-gray-600">
        Data provided by{' '}
        <a href="https://www.igdb.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:underline">
          IGDB.com
        </a>
      </p>
    </div>
  )
}

/* ---------- Search results ---------- */

function SearchResults({
  results,
  query,
  isLoading,
  onSelectGame,
}: {
  results: GameSearchResult[]
  query: string
  isLoading: boolean
  onSelectGame: (game: GameSearchResult) => void
}) {
  const igdbIds = results.map((g) => g.igdbId)
  const { data: subsMap = {} } = useQuery({
    queryKey: ['subsCheck', igdbIds.join(',')],
    queryFn: () => checkSubscriptions(igdbIds),
    enabled: igdbIds.length > 0,
  })

  if (!isLoading && results.length === 0) {
    return <p className="mt-4 text-gray-500">No results found for "{query}"</p>
  }

  return (
    <div className="mt-4 space-y-2">
      {results.map((game) => (
        <GameRow
          key={game.igdbId}
          game={game}
          services={subsMap[game.igdbId] ?? []}
          onClick={() => onSelectGame(game)}
        />
      ))}
    </div>
  )
}

/* ---------- Popular games ---------- */

function PopularGamesSection({ onSelectGame }: { onSelectGame: (g: GameSearchResult) => void }) {
  const { data: games = [], isLoading } = useQuery({
    queryKey: ['popularGames'],
    queryFn: () => getPopularGames(12),
    staleTime: 5 * 60_000,
  })

  const igdbIds = games.map((g) => g.igdbId)
  const { data: subsMap = {} } = useQuery({
    queryKey: ['subsCheck', 'popular', igdbIds.join(',')],
    queryFn: () => checkSubscriptions(igdbIds),
    enabled: igdbIds.length > 0,
  })

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-xl font-bold">Popular Games</h2>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg bg-gray-800" style={{ aspectRatio: '3/4' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {games.map((game) => (
            <GameTile
              key={game.igdbId}
              game={game}
              services={subsMap[game.igdbId] ?? []}
              onClick={() => onSelectGame(game)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/* ---------- Browse by service ---------- */

function BrowseByServiceSection({ onSelectGame }: { onSelectGame: (g: GameSearchResult) => void }) {
  const [activeService, setActiveService] = useState<string | null>(null)

  const { data: stats = [] } = useQuery({
    queryKey: ['subscriptionStats'],
    queryFn: getSubscriptionStats,
    staleTime: 5 * 60_000,
  })

  const { data: serviceData } = useQuery({
    queryKey: ['serviceGames', activeService],
    queryFn: () => getServiceGames(activeService!, 1, 12),
    enabled: !!activeService,
    staleTime: 5 * 60_000,
  })

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-bold">Browse by Service</h2>

      <div className="flex flex-wrap gap-2">
        {stats.map((stat) => (
          <button
            key={stat.slug}
            onClick={() => setActiveService(activeService === stat.slug ? null : stat.slug)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              activeService === stat.slug
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {serviceLabels[stat.slug] ?? stat.slug}
            <span className="ml-1.5 text-xs opacity-60">{stat.count}</span>
          </button>
        ))}
      </div>

      {activeService && serviceData && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {serviceData.games.map((game) => (
              <GameTile
                key={game.igdbId}
                game={game}
                services={[activeService]}
                onClick={() => onSelectGame(game)}
              />
            ))}
          </div>
          {serviceData.total > 12 && (
            <p className="mt-3 text-sm text-gray-500">
              Showing 12 of {serviceData.total} games on {serviceLabels[activeService] ?? activeService}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/* ---------- Shared game components ---------- */

function GameTile({
  game,
  services,
  onClick,
}: {
  game: GameSearchResult
  services: string[]
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-lg border border-gray-800 bg-gray-900 text-left transition-colors hover:border-gray-600"
    >
      {game.coverImageId ? (
        <img
          src={igdbImageUrl(game.coverImageId, 'cover_big')}
          alt={game.title}
          className="aspect-[3/4] w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center bg-gray-800 text-xs text-gray-600">
          No image
        </div>
      )}

      {/* Overlay on hover */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <div className="p-2">
          {game.aggregatedRating != null && (
            <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${
              game.aggregatedRating >= 75
                ? 'bg-green-900/70 text-green-400'
                : game.aggregatedRating >= 50
                  ? 'bg-yellow-900/70 text-yellow-400'
                  : 'bg-red-900/70 text-red-400'
            }`}>
              {game.aggregatedRating}
            </span>
          )}
          {services.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {services.slice(0, 2).map((s) => (
                <span key={s} className="rounded bg-blue-900/60 px-1.5 py-0.5 text-[10px] text-blue-300">
                  {serviceLabels[s] ?? s}
                </span>
              ))}
              {services.length > 2 && (
                <span className="text-[10px] text-gray-400">+{services.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-2">
        <p className="line-clamp-2 text-sm font-medium leading-tight">{game.title}</p>
        {game.firstReleaseDate && (
          <p className="mt-0.5 text-xs text-gray-500">
            {new Date(game.firstReleaseDate).getFullYear()}
          </p>
        )}
      </div>
    </button>
  )
}

function GameRow({
  game,
  services,
  onClick,
}: {
  game: GameSearchResult
  services: string[]
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full gap-4 rounded border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-gray-600"
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
          {game.firstReleaseDate && (
            <span className="shrink-0 text-sm text-gray-500">
              {new Date(game.firstReleaseDate).getFullYear()}
            </span>
          )}
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
    </button>
  )
}
