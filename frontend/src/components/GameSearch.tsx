import { useGameSearch } from '../hooks/useGameSearch'
import { igdbImageUrl } from '../lib/api'
import type { GameSearchResult } from '../types'

export function GameSearch() {
  const { input, setInput, results, isLoading, query } = useGameSearch()

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Search Games</h2>

      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search for a game..."
          className="w-full rounded border border-gray-700 bg-gray-800 px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        {isLoading && (
          <div className="absolute right-3 top-3.5 text-sm text-gray-500">
            Searching...
          </div>
        )}
      </div>

      {query && !isLoading && results.length === 0 && (
        <p className="mt-4 text-gray-500">No results found for "{query}"</p>
      )}

      {results.length > 0 && (
        <div className="mt-4 space-y-3">
          {results.map((game) => (
            <GameCard key={game.igdbId} game={game} />
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-600">
        Data provided by{' '}
        <a
          href="https://www.igdb.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:underline"
        >
          IGDB.com
        </a>
      </p>
    </div>
  )
}

function GameCard({ game }: { game: GameSearchResult }) {
  return (
    <div className="flex gap-4 rounded border border-gray-800 bg-gray-900 p-4">
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
              <span
                key={p}
                className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400"
              >
                {p}
              </span>
            ))}
          </div>
        )}

        {game.genres.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {game.genres.map((g) => (
              <span
                key={g}
                className="text-xs text-gray-500"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {game.summary && (
          <p className="mt-1.5 line-clamp-2 text-sm text-gray-400">
            {game.summary}
          </p>
        )}
      </div>
    </div>
  )
}
