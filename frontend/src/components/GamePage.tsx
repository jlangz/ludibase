import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { igdbImageUrl, getGameSubscriptions } from '../lib/api'
import { SUBSCRIPTION_SERVICES } from '../constants/gaming'
import type { GameSearchResult } from '../types'

const API_BASE = '/api'

const serviceLabels = Object.fromEntries(
  SUBSCRIPTION_SERVICES.map((s) => [s.value, s.label])
)

async function fetchGame(igdbId: number): Promise<GameSearchResult> {
  const res = await fetch(`${API_BASE}/games/${igdbId}`)
  if (!res.ok) throw new Error('Game not found')
  return res.json()
}

export function GamePage() {
  const { igdbId } = useParams<{ igdbId: string }>()
  const id = Number(igdbId)

  const { data: game, isLoading, error } = useQuery({
    queryKey: ['game', id],
    queryFn: () => fetchGame(id),
    enabled: !isNaN(id) && id > 0,
  })

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['gameSubscriptions', id],
    queryFn: () => getGameSubscriptions(id),
    enabled: !isNaN(id) && id > 0,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500" />
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-gray-400">Game not found</p>
        <Link to="/" className="mt-4 inline-block text-sm text-blue-400 hover:underline">
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link to="/" className="mb-6 inline-block text-sm text-gray-500 hover:text-gray-300">
        ← Back
      </Link>

      {/* Hero section */}
      <div className="flex flex-col gap-6 sm:flex-row">
        {game.coverImageId ? (
          <img
            src={igdbImageUrl(game.coverImageId, 'cover_big')}
            alt={game.title}
            className="h-[374px] w-[264px] shrink-0 self-start rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-[374px] w-[264px] shrink-0 items-center justify-center self-start rounded-lg bg-gray-800 text-gray-600">
            No image
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold">{game.title}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-400">
            {game.firstReleaseDate && (
              <span>{new Date(game.firstReleaseDate).getFullYear()}</span>
            )}
            {game.developer && <span>{game.developer}</span>}
            {game.publisher && game.publisher !== game.developer && (
              <span className="text-gray-500">{game.publisher}</span>
            )}
          </div>

          {/* Rating */}
          {game.aggregatedRating != null && (
            <div className="mt-4 flex items-center gap-3">
              <span className={`rounded-lg px-3 py-1.5 text-lg font-bold ${
                game.aggregatedRating >= 75
                  ? 'bg-green-900/50 text-green-400'
                  : game.aggregatedRating >= 50
                    ? 'bg-yellow-900/50 text-yellow-400'
                    : 'bg-red-900/50 text-red-400'
              }`}>
                {game.aggregatedRating}
              </span>
              <span className="text-sm text-gray-500">
                Critic score{game.ratingCount ? ` from ${game.ratingCount} reviews` : ''}
              </span>
            </div>
          )}

          {/* Genres */}
          {game.genres.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {game.genres.map((g) => (
                <span key={g} className="rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-300">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Summary */}
          {game.summary && (
            <p className="mt-5 leading-relaxed text-gray-300">{game.summary}</p>
          )}
        </div>
      </div>

      {/* Detail sections */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {/* Platforms */}
        {game.platforms.length > 0 && (
          <Section title="Platforms">
            <div className="flex flex-wrap gap-2">
              {game.platforms.map((p) => (
                <span key={p} className="rounded bg-gray-800 px-3 py-1.5 text-sm text-gray-300">
                  {p}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Subscription services */}
        {subscriptions.length > 0 && (
          <Section title="Available On">
            <div className="flex flex-wrap gap-2">
              {subscriptions.map((sub) => (
                <span
                  key={sub.service}
                  className="rounded bg-blue-900/40 px-3 py-1.5 text-sm text-blue-300"
                >
                  {serviceLabels[sub.service] ?? sub.service}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Details */}
        <Section title="Details">
          <dl className="space-y-2 text-sm">
            {game.developer && (
              <div className="flex gap-2">
                <dt className="text-gray-500">Developer</dt>
                <dd className="text-gray-300">{game.developer}</dd>
              </div>
            )}
            {game.publisher && (
              <div className="flex gap-2">
                <dt className="text-gray-500">Publisher</dt>
                <dd className="text-gray-300">{game.publisher}</dd>
              </div>
            )}
            {game.firstReleaseDate && (
              <div className="flex gap-2">
                <dt className="text-gray-500">Released</dt>
                <dd className="text-gray-300">
                  {new Date(game.firstReleaseDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
            )}
            {game.category != null && game.category > 0 && (
              <div className="flex gap-2">
                <dt className="text-gray-500">Type</dt>
                <dd className="text-gray-300">{categoryLabel(game.category)}</dd>
              </div>
            )}
          </dl>
        </Section>

        {/* Links */}
        {game.igdbUrl && (
          <Section title="Links">
            <a
              href={game.igdbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:underline"
            >
              View on IGDB →
            </a>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h2>
      {children}
    </div>
  )
}

function categoryLabel(category: number): string {
  const labels: Record<number, string> = {
    1: 'DLC',
    2: 'Expansion',
    3: 'Bundle',
    4: 'Standalone Expansion',
    5: 'Mod',
    6: 'Episode',
    7: 'Season',
    8: 'Remake',
    9: 'Remaster',
    10: 'Expanded Game',
    11: 'Port',
    12: 'Fork',
    13: 'Pack',
    14: 'Update',
  }
  return labels[category] ?? 'Game'
}
