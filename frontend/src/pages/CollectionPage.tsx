import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCollection } from '../hooks/useCollection'
import { igdbImageUrl } from '../lib/api'
import { Library } from 'lucide-react'

const SOURCE_TABS = [
  { value: undefined, label: 'All' },
  { value: 'manual', label: 'Manual' },
  { value: 'steam', label: 'Steam' },
] as const

export function CollectionPage() {
  const { user } = useAuth()
  const [source, setSource] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const { data, isLoading } = useCollection(page, source)

  if (!user) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-gray-400">Sign in to view your game collection</p>
        <Link to="/login" className="mt-4 inline-block text-sm text-blue-400 hover:underline">
          Log In
        </Link>
      </div>
    )
  }

  const games = data?.games ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Library className="h-6 w-6" />
          My Games
        </h1>
        {total > 0 && (
          <span className="text-sm text-gray-500">{total} game{total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Source filter tabs */}
      <div className="mb-6 flex gap-2">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => { setSource(tab.value); setPage(1) }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              source === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg bg-gray-800" style={{ aspectRatio: '3/4' }} />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">No games in your collection yet</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link to="/search" className="text-sm text-blue-400 hover:underline">
              Search for games
            </Link>
            <Link to="/profile" className="text-sm text-blue-400 hover:underline">
              Connect Steam
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {games.map((game) => (
              <Link
                key={game.igdbId}
                to={`/game/${game.igdbId}`}
                className="group overflow-hidden rounded-lg border border-gray-800 bg-gray-900 transition-colors hover:border-gray-600"
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
                <div className="p-2">
                  <p className="line-clamp-2 text-sm font-medium leading-tight">{game.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {game.ownedPlatforms && game.ownedPlatforms.length > 0 && (
                      game.ownedPlatforms.map((p) => (
                        <span key={p} className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">{p}</span>
                      ))
                    )}
                    {game.source === 'steam' && (
                      <span className="text-[10px] text-gray-500">Steam</span>
                    )}
                    {game.steamPlaytimeMinutes != null && game.steamPlaytimeMinutes > 0 && (
                      <span className="text-[10px] text-gray-500">
                        {Math.round(game.steamPlaytimeMinutes / 60)}h played
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

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
  )
}
