import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { getCollection, addToCollection, removeFromCollection, checkCollection, type CollectionListParams } from '../lib/api'

export function useCollection(params: CollectionListParams = {}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['collection', user?.id, params],
    queryFn: () => getCollection({ pageSize: 20, ...params }),
    enabled: !!user,
    staleTime: 60_000,
  })

  const addMutation = useMutation({
    mutationFn: ({ igdbId, platforms, storefronts }: { igdbId: number; platforms?: string[]; storefronts?: string[] }) =>
      addToCollection(igdbId, platforms, storefronts),
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
    addGame: (igdbId: number, platforms?: string[], storefronts?: string[]) => addMutation.mutateAsync({ igdbId, platforms, storefronts }),
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
