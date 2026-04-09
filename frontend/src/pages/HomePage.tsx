import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  getPopularGames,
  getSubscriptionStats,
  getServiceGames,
  checkSubscriptions,
  igdbImageUrl,
} from '../lib/api'
import { SUBSCRIPTION_SERVICES, SERVICE_FAMILIES } from '../constants/gaming'
import type { GameSearchResult } from '../types'

const serviceLabels = Object.fromEntries(
  SUBSCRIPTION_SERVICES.map((s) => [s.value, s.label])
)

// Map each service slug to its family key for "View all" links
const slugToFamily = Object.fromEntries(
  Object.entries(SERVICE_FAMILIES).flatMap(([familyKey, fam]) =>
    fam.tiers.map((t) => [t.slug, familyKey])
  )
)

export function HomePage() {
  return (
    <div>
      <PopularGamesSection />
      <BrowseByServiceSection />

      <p className="mt-8 text-xs text-gray-600">
        Data provided by{' '}
        <a href="https://www.igdb.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:underline">
          IGDB.com
        </a>
      </p>
    </div>
  )
}

/* ---------- Popular games ---------- */

function PopularGamesSection() {
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
    <section>
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
            />
          ))}
        </div>
      )}
    </section>
  )
}

/* ---------- Browse by service ---------- */

function BrowseByServiceSection() {
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
              />
            ))}
          </div>
          {serviceData.total > 12 && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-gray-500">
                Showing 12 of {serviceData.total} games
              </span>
              {slugToFamily[activeService] && (
                <Link
                  to={`/services/${slugToFamily[activeService]}`}
                  className="text-sm text-blue-400 hover:underline"
                >
                  View all →
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* ---------- Game tile ---------- */

function GameTile({
  game,
  services,
}: {
  game: GameSearchResult
  services: string[]
}) {
  return (
    <Link
      to={`/game/${game.igdbId}`}
      className="group relative overflow-hidden rounded-lg border border-gray-800 bg-gray-900 transition-colors hover:border-gray-600"
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
    </Link>
  )
}
