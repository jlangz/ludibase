import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCollection } from '../hooks/useCollection'
import { useSteamConnection } from '../hooks/useSteamConnection'
import { igdbImageUrl } from '../lib/api'
import { STOREFRONTS } from '../constants/gaming'
import { Library, Download, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react'
import type { SteamImportResult } from '../types'

const storefrontLabels = Object.fromEntries(
  STOREFRONTS.map((s) => [s.value, s.label])
)

export function CollectionPage() {
  const { user } = useAuth()
  const [storefront, setStorefront] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const { data, isLoading } = useCollection(page, storefront)
  const steam = useSteamConnection()
  const [showImportModal, setShowImportModal] = useState(false)

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
  const userStorefronts = data?.storefronts ?? []

  const showSteamImport = steam.isConnected && (storefront === undefined || storefront === 'steam')

  return (
    <div>
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

      {/* Storefront filter tabs — only show storefronts the user has games in */}
      {userStorefronts.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => { setStorefront(undefined); setPage(1) }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              storefront === undefined
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {userStorefronts.map((sf) => (
            <button
              key={sf}
              onClick={() => { setStorefront(sf); setPage(1) }}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                storefront === sf
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {storefrontLabels[sf] ?? sf}
            </button>
          ))}
        </div>
      )}

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
            {steam.isConnected ? (
              <button
                onClick={() => setShowImportModal(true)}
                className="text-sm text-blue-400 hover:underline"
              >
                Import from Steam
              </button>
            ) : (
              <Link to="/profile" className="text-sm text-blue-400 hover:underline">
                Connect Steam
              </Link>
            )}
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
                    className="aspect-3/4 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-3/4 w-full items-center justify-center bg-gray-800 text-xs text-gray-600">
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
                    {game.storefronts && game.storefronts.length > 0 && (
                      game.storefronts.map((s) => (
                        <span key={s} className="rounded bg-blue-900/30 px-1.5 py-0.5 text-[10px] text-blue-400">
                          {storefrontLabels[s] ?? s}
                        </span>
                      ))
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

      {showImportModal && (
        <SteamImportModal
          steam={steam}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  )
}

function SteamImportModal({
  steam,
  onClose,
}: {
  steam: ReturnType<typeof useSteamConnection>
  onClose: () => void
}) {
  const [status, setStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<SteamImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleImport() {
    setStatus('importing')
    setError(null)
    try {
      const res = await steam.importLibrary()
      setResult(res)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      setStatus('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== 'importing') onClose()
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <h2 className="text-lg font-semibold">Import Steam Library</h2>
          {status !== 'importing' && (
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="px-5 py-6">
          {status === 'idle' && (
            <div className="text-center">
              <p className="text-sm text-gray-400">
                This will import your Steam game library and match games to our database.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Connected as {steam.connection?.steamUsername ?? 'Steam user'}
              </p>
              <button
                onClick={handleImport}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                Start Import
              </button>
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
                <p className="text-gray-300">
                  <span className="font-medium text-green-400">{result.matched}</span> games matched and imported
                </p>
                <p className="text-gray-500">{result.total} total games in your Steam library</p>
                {result.unmatched > 0 && (
                  <p className="text-gray-500">
                    {result.unmatched} games couldn't be matched to our database
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="mt-5 w-full rounded bg-gray-800 py-2.5 text-sm font-medium hover:bg-gray-700"
              >
                Done
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
              <p className="mt-3 text-lg font-medium">Import Failed</p>
              <p className="mt-2 text-sm text-gray-400">{error}</p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={handleImport}
                  className="flex-1 rounded bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 rounded bg-gray-800 py-2.5 text-sm font-medium hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
