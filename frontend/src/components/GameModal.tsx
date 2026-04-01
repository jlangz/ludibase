import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { igdbImageUrl, getGameSubscriptions } from '../lib/api'
import { SUBSCRIPTION_SERVICES } from '../constants/gaming'
import type { GameSearchResult } from '../types'

const serviceLabels = Object.fromEntries(
  SUBSCRIPTION_SERVICES.map((s) => [s.value, s.label])
)

interface GameModalProps {
  game: GameSearchResult
  onClose: () => void
}

export function GameModal({ game, onClose }: GameModalProps) {
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['gameSubscriptions', game.igdbId],
    queryFn: () => getGameSubscriptions(game.igdbId),
  })

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-start gap-5 p-6">
          {game.coverImageId ? (
            <img
              src={igdbImageUrl(game.coverImageId, 'cover_big')}
              alt={game.title}
              className="h-[187px] w-[132px] shrink-0 rounded object-cover"
            />
          ) : (
            <div className="flex h-[187px] w-[132px] shrink-0 items-center justify-center rounded bg-gray-800 text-sm text-gray-600">
              No image
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-bold leading-tight">{game.title}</h2>
              <button
                onClick={onClose}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
              {game.firstReleaseDate && (
                <span>{new Date(game.firstReleaseDate).getFullYear()}</span>
              )}
              {game.developer && <span>{game.developer}</span>}
              {game.publisher && game.publisher !== game.developer && (
                <span>{game.publisher}</span>
              )}
            </div>

            {game.aggregatedRating != null && (
              <div className="mt-3 flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-sm font-semibold ${
                  game.aggregatedRating >= 75
                    ? 'bg-green-900/50 text-green-400'
                    : game.aggregatedRating >= 50
                      ? 'bg-yellow-900/50 text-yellow-400'
                      : 'bg-red-900/50 text-red-400'
                }`}>
                  {game.aggregatedRating}
                </span>
                <span className="text-xs text-gray-500">
                  Critic score{game.ratingCount ? ` (${game.ratingCount} reviews)` : ''}
                </span>
              </div>
            )}

            {game.genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {game.genres.map((g) => (
                  <span key={g} className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-300">
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {game.summary && (
          <div className="border-t border-gray-800 px-6 py-4">
            <p className="text-sm leading-relaxed text-gray-300">{game.summary}</p>
          </div>
        )}

        {game.platforms.length > 0 && (
          <div className="border-t border-gray-800 px-6 py-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Platforms</h3>
            <div className="flex flex-wrap gap-1.5">
              {game.platforms.map((p) => (
                <span key={p} className="rounded bg-gray-800 px-2 py-1 text-sm text-gray-300">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {subscriptions.length > 0 && (
          <div className="border-t border-gray-800 px-6 py-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Available On</h3>
            <div className="flex flex-wrap gap-1.5">
              {subscriptions.map((sub) => (
                <span
                  key={sub.service}
                  className="rounded bg-blue-900/40 px-2.5 py-1 text-sm text-blue-300"
                >
                  {serviceLabels[sub.service] ?? sub.service}
                </span>
              ))}
            </div>
          </div>
        )}

        {game.igdbUrl && (
          <div className="border-t border-gray-800 px-6 py-3">
            <a
              href={game.igdbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-400"
            >
              View on IGDB →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
