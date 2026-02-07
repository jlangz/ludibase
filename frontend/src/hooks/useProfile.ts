import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Profile } from '../types'

interface ProfileUpdates {
  username?: string | null
  display_name?: string | null
  bio?: string | null
  avatar_url?: string | null
  platforms?: string[] | null
  subscriptions?: string[] | null
}

export function useProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single()

      if (error) throw error
      return data as Profile
    },
    enabled: !!user,
  })

  const mutation = useMutation({
    mutationFn: async (updates: ProfileUpdates) => {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user!.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    updateProfile: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    updateError: mutation.error,
    isUpdateSuccess: mutation.isSuccess,
    resetMutation: mutation.reset,
  }
}
