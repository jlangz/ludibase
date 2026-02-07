import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const USERNAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$/

export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Must be at least 3 characters'
  if (username.length > 30) return 'Must be 30 characters or less'
  if (!USERNAME_REGEX.test(username)) return 'Only letters, numbers, hyphens, and underscores'
  return null
}

export function useUsernameCheck(username: string, currentUsername: string | null, debounceMs = 400) {
  const [debouncedUsername, setDebouncedUsername] = useState('')

  useEffect(() => {
    const trimmed = username.trim().toLowerCase()

    // Don't check if it's the user's current username
    if (trimmed === (currentUsername ?? '').toLowerCase()) {
      setDebouncedUsername('')
      return
    }

    // Don't check if validation fails
    if (!trimmed || validateUsername(trimmed)) {
      setDebouncedUsername('')
      return
    }

    const timer = setTimeout(() => setDebouncedUsername(trimmed), debounceMs)
    return () => clearTimeout(timer)
  }, [username, currentUsername, debounceMs])

  const { data: isAvailable, isLoading: isChecking } = useQuery({
    queryKey: ['usernameCheck', debouncedUsername],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_username_available', {
        desired_username: debouncedUsername,
      })
      if (error) throw error
      return data as boolean
    },
    enabled: debouncedUsername.length >= 3,
    staleTime: 30_000,
  })

  return {
    isAvailable: debouncedUsername ? isAvailable ?? null : null,
    isChecking: debouncedUsername ? isChecking : false,
  }
}
