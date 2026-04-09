import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useGameSearch } from '../hooks/useGameSearch'
import { igdbImageUrl } from '../lib/api'
import { Search } from 'lucide-react';

export function Header() {
  const { user, loading, signOut } = useAuth()
  const { profile } = useProfile()
  const navigate = useNavigate()
  const search = useGameSearch()
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const showDropdown = isFocused && search.query.length >= 2

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectGame(igdbId: number) {
    search.setInput('')
    setIsFocused(false)
    navigate(`/game/${igdbId}`)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-gray-800 px-6 py-3 max-w-480 mx-auto">
      <Link to="/" className="shrink-0 text-lg font-bold hover:text-gray-300">
        GameSubsCheck
      </Link>

      {/* Search bar */}
      <div ref={containerRef} className="relative mx-4 max-w-md flex-1">
        <input
          type="text"
          value={search.input}
          onChange={(e) => search.setInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Find a game..."
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        {search.isLoading && (
          <div className="absolute right-3 top-2 text-xs text-gray-500">...</div>
        )}

        {/* Dropdown results */}
        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
            {search.results.length === 0 && !search.isLoading ? (
              <p className="px-4 py-3 text-sm text-gray-500">No results for "{search.query}"</p>
            ) : (
              search.results.slice(0, 8).map((game) => (
                <button
                  key={game.igdbId}
                  onClick={() => selectGame(game.igdbId)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-800"
                >
                  {game.coverImageId ? (
                    <img
                      src={igdbImageUrl(game.coverImageId, 'cover_small')}
                      alt=""
                      className="h-12 w-8.5 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-8.5 shrink-0 items-center justify-center rounded bg-gray-800 text-[8px] text-gray-600">
                      ?
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{game.title}</p>
                    <p className="truncate text-xs text-gray-500">
                      {[
                        game.firstReleaseDate && new Date(game.firstReleaseDate).getFullYear(),
                        game.developer,
                        game.platforms.slice(0, 3).join(', '),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  {game.aggregatedRating != null && (
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${
                      game.aggregatedRating >= 75
                        ? 'bg-green-900/50 text-green-400'
                        : game.aggregatedRating >= 50
                          ? 'bg-yellow-900/50 text-yellow-400'
                          : 'bg-red-900/50 text-red-400'
                    }`}>
                      {game.aggregatedRating}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <Link to="/search" className="border py-1 px-2 rounded-md shrink-0 text-sm text-gray-400 hover:text-gray-200 flex flex-row justify-center items-center">
        Search by Service <Search className="ml-2 h-4 w-4" />
      </Link>

      {/* Auth nav */}
      {!loading && (
        <nav className="flex shrink-0 items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-gray-400">
                {profile?.username ? `@${profile.username}` : user.email}
              </span>
              <Link to="/profile" className="text-sm text-blue-400 hover:underline">
                Profile
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded border border-gray-700 px-3 py-1 text-sm hover:bg-gray-800"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-blue-400 hover:underline">
                Log In
              </Link>
              <Link
                to="/signup"
                className="rounded bg-blue-600 px-3 py-1 text-sm font-medium hover:bg-blue-700"
              >
                Sign Up
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  )
}
