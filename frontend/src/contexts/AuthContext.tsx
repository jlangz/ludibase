import { createContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  needsPasswordReset: boolean
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>
  clearPasswordReset: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false)

  useEffect(() => {
    // Check for an existing session (e.g. page refresh with stored token)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Subscribe to future auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (event === 'PASSWORD_RECOVERY') {
          setNeedsPasswordReset(true)
        }

        // Clear cached data when user signs out to prevent data leaks
        if (!session) {
          queryClient.clear()
        }
      }
    )

    // Cleanup: unsubscribe when the component unmounts
    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) setNeedsPasswordReset(false)
    return { error }
  }

  function clearPasswordReset() {
    setNeedsPasswordReset(false)
  }

  return (
    <AuthContext.Provider value={{
      user, session, loading, needsPasswordReset,
      signUp, signIn, signOut, updatePassword, clearPasswordReset,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
