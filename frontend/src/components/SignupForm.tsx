import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export function SignupForm({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { error } = await signUp(email, password)
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <h2 className="mb-4 text-2xl font-bold">Check Your Email</h2>
        <p className="mb-6 text-gray-400">
          We sent a confirmation link to <span className="text-gray-100">{email}</span>.
          Click it to activate your account.
        </p>
        <button
          onClick={() => onNavigate('login')}
          className="text-blue-400 hover:underline"
        >
          Back to log in
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm">
      <h2 className="mb-6 text-2xl font-bold">Sign Up</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-gray-400">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-gray-400">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm text-gray-400">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-400">
        Already have an account?{' '}
        <button
          onClick={() => onNavigate('login')}
          className="text-blue-400 hover:underline"
        >
          Log in
        </button>
      </p>
    </div>
  )
}
