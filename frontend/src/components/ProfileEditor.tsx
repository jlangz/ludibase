import { useEffect, useState } from 'react'
import { useProfile } from '../hooks/useProfile'
import { useUsernameCheck, validateUsername } from '../hooks/useUsernameCheck'
import { useAuth } from '../hooks/useAuth'
import { AvatarUploader } from './AvatarUploader'
import { MultiSelectChips } from './MultiSelectChips'
import { PLATFORMS, SUBSCRIPTION_SERVICES } from '../constants/gaming'

interface FormState {
  username: string
  displayName: string
  bio: string
  platforms: string[]
  subscriptions: string[]
}

export function ProfileEditor({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user } = useAuth()
  const { profile, isLoading, updateProfile, isUpdating, isUpdateSuccess, resetMutation } = useProfile()

  const [form, setForm] = useState<FormState>({
    username: '',
    displayName: '',
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
        displayName: profile.display_name ?? '',
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
        display_name: form.displayName.trim() || null,
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
            displayName={form.displayName}
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

          {/* Display Name */}
          <div>
            <label htmlFor="displayName" className="mb-1 block text-sm text-gray-400">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={form.displayName}
              onChange={(e) => updateField('displayName', e.target.value)}
              placeholder="How you want to be known"
              className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none"
            />
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
            onClick={() => onNavigate('home')}
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
    </div>
  )
}
