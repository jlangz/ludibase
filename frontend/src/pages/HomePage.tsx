import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  getPopularGames,
  getSubscriptionStats,
  getServiceGames,
  checkSubscriptions,
  igdbImageUrl,
  getNews,
} from '../lib/api'
import type { NewsItem } from '../lib/api'
import { useSavedArticles } from '../hooks/useSavedArticles'
import { useAuth } from '../hooks/useAuth'
import { SUBSCRIPTION_SERVICES, SERVICE_FAMILIES } from '../constants/gaming'
import { X, ExternalLink, Bookmark } from 'lucide-react'
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
      <NewsSection />

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

  const { data: serviceData, isLoading: isLoadingService } = useQuery({
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

      {activeService && (
        <div className="mt-4">
          {isLoadingService || !serviceData ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg bg-gray-800" style={{ aspectRatio: '3/4' }} />
              ))}
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </section>
  )
}

/* ---------- News ---------- */

function NewsSection() {
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null)
  const { user } = useAuth()
  const saved = useSavedArticles()
  const { data: news = [], isLoading } = useQuery({
    queryKey: ['news'],
    queryFn: () => getNews(8),
    staleTime: 10 * 60_000,
  })

  if (isLoading) {
    return (
      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold">Gaming News</h2>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-800" />
          ))}
        </div>
      </section>
    )
  }

  if (news.length === 0) return null

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Gaming News</h2>
        {user && (
          <Link to="/saved-articles" className="text-sm text-blue-400 hover:underline">
            Saved Articles
          </Link>
        )}
      </div>
      <div className="space-y-3">
        {news.map((item, i) => (
          <button
            key={`${item.link}-${i}`}
            onClick={() => setSelectedArticle(item)}
            className="flex w-full gap-4 rounded-lg border border-gray-800 bg-gray-900 p-3 text-left transition-colors hover:border-gray-600"
          >
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt=""
                className="h-20 w-32 shrink-0 rounded object-cover"
                loading="lazy"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-tight line-clamp-2">{item.title}</p>
                {user && (
                  <Bookmark
                    className={`h-4 w-4 shrink-0 ${saved.isSaved(item.link) ? 'fill-blue-400 text-blue-400' : 'text-gray-600'}`}
                  />
                )}
              </div>
              {item.description && (
                <p className="mt-1 text-sm text-gray-400 line-clamp-2">{item.description}</p>
              )}
              <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                <span>{item.source}</span>
                <span>·</span>
                <span>{formatTimeAgo(item.pubDate)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          isSaved={saved.isSaved(selectedArticle.link)}
          onSave={() => saved.isSaved(selectedArticle.link) ? saved.unsave(selectedArticle.link) : saved.save(selectedArticle)}
          showSave={!!user}
          onClose={() => setSelectedArticle(null)}
        />
      )}
    </section>
  )
}

function ArticleModal({
  article,
  isSaved,
  onSave,
  showSave,
  onClose,
}: {
  article: NewsItem
  isSaved: boolean
  onSave: () => void
  showSave: boolean
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
        {article.imageUrl && (
          <img
            src={article.imageUrl}
            alt=""
            className="h-64 w-full rounded-t-lg object-cover"
          />
        )}

        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-bold leading-tight">{article.title}</h2>
            <button onClick={onClose} className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <span>{article.source}</span>
            <span>·</span>
            <span>{formatTimeAgo(article.pubDate)}</span>
          </div>

          {article.description && (
            <p className="mt-4 leading-relaxed text-gray-300">{article.description}</p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <ExternalLink className="h-4 w-4" />
              Read Full Article
            </a>
            {showSave && (
              <button
                onClick={onSave}
                className={`flex items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors ${
                  isSaved
                    ? 'bg-blue-900/40 text-blue-400 hover:bg-red-900/40 hover:text-red-400'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
                {isSaved ? 'Saved' : 'Save for Later'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
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
