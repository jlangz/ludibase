import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { useUsernameCheck, validateUsername } from '../hooks/useUsernameCheck'
import { useAuth } from '../hooks/useAuth'
import { AvatarUploader } from '../components/AvatarUploader'
import { MultiSelectChips } from '../components/MultiSelectChips'
import { PLATFORMS, SUBSCRIPTION_SERVICES } from '../constants/gaming'
import { useSteamConnection } from '../hooks/useSteamConnection'
import { useSearchParams } from 'react-router-dom'

interface FormState {
  username: string
  bio: string
  platforms: string[]
  subscriptions: string[]
}

export function ProfileEditor() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile, isLoading, updateProfile, isUpdating, isUpdateSuccess, resetMutation } = useProfile()

  const [form, setForm] = useState<FormState>({
    username: '',
    bio: '',
    platforms: [],
    subscriptions: [],
  })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [resetEmailSent, setResetEmailSent] = useState(false)

  const { isAvailable, isChecking } = useUsernameCheck(form.username, profile?.username ?? null)
  const usernameValidation = form.username.trim() ? validateUsername(form.username.trim()) : null

  // Sync server data into form state
  useEffect(() => {
    if (profile) {
      setForm({
        username: profile.username ?? '',
        bio: profile.bio ?? '',
        platforms: profile.platforms ?? [],
        subscriptions: profile.subscriptions ?? [],
      })
      setAvatarUrl(profile.avatar_url)
    }
  }, [profile])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    // Clear success state when user edits
    if (isUpdateSuccess) resetMutation()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)

    const trimmedUsername = form.username.trim() || null

    // Validate username if provided
    if (trimmedUsername) {
      const validationError = validateUsername(trimmedUsername)
      if (validationError) {
        setSaveError(`Username: ${validationError}`)
        return
      }
      if (isAvailable === false) {
        setSaveError('Username is already taken')
        return
      }
    }

    try {
      await updateProfile({
        username: trimmedUsername,
        bio: form.bio.trim() || null,
        avatar_url: avatarUrl,
        platforms: form.platforms.length > 0 ? form.platforms : null,
        subscriptions: form.subscriptions.length > 0 ? form.subscriptions : null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      if (message.includes('profiles_username_unique') || message.includes('duplicate key')) {
        setSaveError('Username is already taken')
      } else {
        setSaveError(message)
      }
    }
  }

  async function handlePasswordReset() {
    if (!user?.email) return
    const { error } = await (await import('../lib/supabase')).supabase.auth.resetPasswordForEmail(
      user.email,
      { redirectTo: `${window.location.origin}` }
    )
    if (error) {
      setSaveError(error.message)
    } else {
      setResetEmailSent(true)
    }
  }

  function handleAvatarChange(url: string | null) {
    setAvatarUrl(url)
    // Immediately persist avatar change
    updateProfile({ avatar_url: url }).catch(() => {})
  }

  const [searchParams, setSearchParams] = useSearchParams()
  const [steamMessage, setSteamMessage] = useState<string | null>(null)

  // Handle Steam callback redirect
  useEffect(() => {
    if (searchParams.get('steam') === 'connected') {
      setSteamMessage('Steam account connected successfully!')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  if (isLoading) {
    return <p className="text-gray-400">Loading profile...</p>
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-6 text-2xl font-bold">Profile Settings</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar Section */}
        <section className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h3 className="mb-4 text-lg font-semibold">Avatar</h3>
          <AvatarUploader
            avatarUrl={avatarUrl}
            username={form.username}
            onAvatarChange={handleAvatarChange}
          />
        </section>

        {/* Profile Information */}
        <section className="space-y-4 rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h3 className="text-lg font-semibold">Profile Information</h3>

          {/* Username */}
          <div>
            <label htmlFor="username" className="mb-1 block text-sm text-gray-400">
              Username
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-2 text-gray-500">@</span>
              <input
                id="username"
                type="text"
                value={form.username}
                onChange={(e) => updateField('username', e.target.value.toLowerCase())}
                placeholder="yourname"
                maxLength={30}
                className="w-full rounded border border-gray-700 bg-gray-800 py-2 pl-8 pr-10 text-gray-100 focus:border-blue-500 focus:outline-none"
              />
              {/* Username status indicator */}
              {form.username.trim() && form.username.trim() !== (profile?.username ?? '') && (
                <span className="absolute right-3 top-2.5 text-sm">
                  {usernameValidation ? (
                    <span className="text-red-400" title={usernameValidation}>!</span>
                  ) : isChecking ? (
                    <span className="text-gray-500">...</span>
                  ) : isAvailable === true ? (
                    <span className="text-green-400">&#10003;</span>
                  ) : isAvailable === false ? (
                    <span className="text-red-400">&#10007;</span>
                  ) : null}
                </span>
              )}
            </div>
            {usernameValidation && form.username.trim() && (
              <p className="mt-1 text-xs text-red-400">{usernameValidation}</p>
            )}
            {!usernameValidation && isAvailable === false && (
              <p className="mt-1 text-xs text-red-400">Username is taken</p>
            )}
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="mb-1 block text-sm text-gray-400">
              Bio
            </label>
            <textarea
              id="bio"
              value={form.bio}
              onChange={(e) => updateField('bio', e.target.value.slice(0, 500))}
              placeholder="Tell us about your gaming interests..."
              rows={3}
              className="w-full resize-none rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-gray-600">
              {form.bio.length}/500
            </p>
          </div>
        </section>

        {/* Gaming Preferences */}
        <section className="space-y-5 rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h3 className="text-lg font-semibold">Gaming Preferences</h3>

          <div>
            <label className="mb-2 block text-sm text-gray-400">Platforms I Play</label>
            <MultiSelectChips
              options={PLATFORMS}
              selected={form.platforms}
              onChange={(platforms) => updateField('platforms', platforms)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-400">My Subscriptions</label>
            <MultiSelectChips
              options={SUBSCRIPTION_SERVICES}
              selected={form.subscriptions}
              onChange={(subscriptions) => updateField('subscriptions', subscriptions)}
            />
          </div>
        </section>

        {/* Account Security */}
        <section className="space-y-3 rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h3 className="text-lg font-semibold">Account</h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Email</p>
              <p className="text-sm">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-800 pt-3">
            <div>
              <p className="text-sm text-gray-400">Password</p>
              <p className="text-xs text-gray-600">Send a reset link to your email</p>
            </div>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetEmailSent}
              className="rounded border border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {resetEmailSent ? 'Email Sent' : 'Reset Password'}
            </button>
          </div>
        </section>

        {/* Connected Accounts */}
        <SteamSection />

        {/* Save / Cancel */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isUpdating}
            className="rounded bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isUpdating ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded border border-gray-700 px-5 py-2.5 hover:bg-gray-800"
          >
            Cancel
          </button>
          {isUpdateSuccess && (
            <span className="text-sm text-green-400">Settings saved!</span>
          )}
          {saveError && (
            <span className="text-sm text-red-400">{saveError}</span>
          )}
        </div>
      </form>

      {steamMessage && (
        <div className="mt-4 rounded-lg border border-green-800 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          {steamMessage}
        </div>
      )}
    </div>
  )
}

function SteamSection() {
  const steam = useSteamConnection()
  const [importResult, setImportResult] = useState<{ matched: number; unmatched: number; total: number } | null>(null)

  async function handleImport() {
    setImportResult(null)
    const result = await steam.importLibrary()
    setImportResult(result)
  }

  return (
    <section className="space-y-3 rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h3 className="text-lg font-semibold">Connected Accounts</h3>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {steam.isConnected && steam.connection?.steamAvatarUrl && (
            <img
              src={steam.connection.steamAvatarUrl}
              alt=""
              className="h-10 w-10 rounded"
            />
          )}
          <div>
            <p className="text-sm font-medium">Steam</p>
            {steam.isConnected ? (
              <p className="text-xs text-gray-400">
                Connected as {steam.connection?.steamUsername ?? steam.connection?.steamId}
                {steam.connection?.lastImportAt && (
                  <> · Last imported {new Date(steam.connection.lastImportAt).toLocaleDateString()}</>
                )}
              </p>
            ) : (
              <p className="text-xs text-gray-500">Not connected</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {steam.isConnected ? (
            <>
              <button
                type="button"
                onClick={handleImport}
                disabled={steam.isImporting}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {steam.isImporting ? 'Importing...' : 'Import Library'}
              </button>
              <button
                type="button"
                onClick={() => steam.disconnect()}
                disabled={steam.isDisconnecting}
                className="rounded border border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => steam.connect()}
              className="rounded bg-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-600"
            >
              Connect Steam
            </button>
          )}
        </div>
      </div>

      {importResult && (
        <div className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm">
          <p className="text-gray-300">
            Imported <span className="font-medium text-green-400">{importResult.matched}</span> of {importResult.total} Steam games
          </p>
          {importResult.unmatched > 0 && (
            <p className="text-xs text-gray-500">
              {importResult.unmatched} games couldn't be matched to our database
            </p>
          )}
        </div>
      )}
    </section>
  )
}
