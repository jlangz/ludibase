import { useEffect, useState } from 'react'
import { useProfile } from '../hooks/useProfile'

export function ProfileEditor({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { profile, isLoading, updateProfile, isUpdating, isUpdateSuccess } = useProfile()
  const [displayName, setDisplayName] = useState('')

  // Sync server data into local form state when it arrives
  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name)
    }
  }, [profile?.display_name])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateProfile({ display_name: displayName })
  }

  if (isLoading) {
    return <p className="text-gray-400">Loading profile...</p>
  }

  return (
    <div className="mx-auto max-w-sm">
      <h2 className="mb-6 text-2xl font-bold">Edit Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="displayName" className="mb-1 block text-sm text-gray-400">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter a display name"
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isUpdating}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isUpdating ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="rounded border border-gray-700 px-4 py-2 hover:bg-gray-800"
          >
            Cancel
          </button>
          {isUpdateSuccess && (
            <span className="text-sm text-green-400">Saved!</span>
          )}
        </div>
      </form>
    </div>
  )
}
