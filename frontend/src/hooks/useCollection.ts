import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { getCollection, addToCollection, removeFromCollection, checkCollection } from '../lib/api'

export function useCollection(page = 1, source?: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['collection', user?.id, page, source],
    queryFn: () => getCollection(page, 20, source),
    enabled: !!user,
    staleTime: 60_000,
  })

  const addMutation = useMutation({
    mutationFn: ({ igdbId, platforms }: { igdbId: number; platforms?: string[] }) =>
      addToCollection(igdbId, platforms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      queryClient.invalidateQueries({ queryKey: ['collectionCheck'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: removeFromCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      queryClient.invalidateQueries({ queryKey: ['collectionCheck'] })
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    addGame: (igdbId: number, platforms?: string[]) => addMutation.mutateAsync({ igdbId, platforms }),
    removeGame: removeMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  }
}

export function useCollectionCheck(igdbIds: number[]) {
  const { user } = useAuth()

  const { data = {} } = useQuery({
    queryKey: ['collectionCheck', igdbIds.join(',')],
    queryFn: () => checkCollection(igdbIds),
    enabled: !!user && igdbIds.length > 0,
    staleTime: 60_000,
  })

  return data
}
