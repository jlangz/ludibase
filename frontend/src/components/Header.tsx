import { useAuth } from '../hooks/useAuth'

export function Header({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user, loading, signOut } = useAuth()

  return (
    <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
      <button
        onClick={() => onNavigate('home')}
        className="text-xl font-bold hover:text-gray-300"
      >
        Game Subscription Tracker
      </button>

      {!loading && (
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-gray-400">{user.email}</span>
              <button
                onClick={() => onNavigate('profile')}
                className="text-sm text-blue-400 hover:underline"
              >
                Profile
              </button>
              <button
                onClick={signOut}
                className="rounded border border-gray-700 px-3 py-1 text-sm hover:bg-gray-800"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onNavigate('login')}
                className="text-sm text-blue-400 hover:underline"
              >
                Log In
              </button>
              <button
                onClick={() => onNavigate('signup')}
                className="rounded bg-blue-600 px-3 py-1 text-sm font-medium hover:bg-blue-700"
              >
                Sign Up
              </button>
            </>
          )}
        </nav>
      )}
    </header>
  )
}
