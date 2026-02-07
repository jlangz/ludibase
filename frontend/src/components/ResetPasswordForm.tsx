import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export function ResetPasswordForm() {
  const { updatePassword, clearPasswordReset } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)
    const { error: updateError } = await updatePassword(password)
    setIsSubmitting(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <h2 className="mb-4 text-2xl font-bold">Password Updated</h2>
        <p className="mb-6 text-gray-400">Your password has been changed successfully.</p>
        <button
          onClick={clearPasswordReset}
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          Continue
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm">
      <h2 className="mb-2 text-2xl font-bold">Set New Password</h2>
      <p className="mb-6 text-sm text-gray-400">Enter your new password below.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="newPassword" className="mb-1 block text-sm text-gray-400">
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="confirmNewPassword" className="mb-1 block text-sm text-gray-400">
            Confirm New Password
          </label>
          <input
            id="confirmNewPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            required
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
