import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'

export function Header() {
  const { user, loading, signOut } = useAuth()
  const { profile } = useProfile()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
      <Link to="/" className="text-xl font-bold hover:text-gray-300">
        Game Subscription Tracker
      </Link>

      {!loading && (
        <nav className="flex items-center gap-4">
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
