import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { getSteamStatus, getSteamConnectUrl, importSteamLibrary, disconnectSteam } from '../lib/api'

export function useSteamConnection() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: ['steamStatus', user?.id],
    queryFn: getSteamStatus,
    enabled: !!user,
    staleTime: 60_000,
  })

  const connectMutation = useMutation({
    mutationFn: async () => {
      const url = await getSteamConnectUrl()
      window.location.href = url
    },
  })

  const importMutation = useMutation({
    mutationFn: importSteamLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['steamStatus'] })
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      queryClient.invalidateQueries({ queryKey: ['collectionCheck'] })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: disconnectSteam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['steamStatus'] })
    },
  })

  return {
    connection: statusQuery.data ?? null,
    isConnected: !!statusQuery.data,
    isLoading: statusQuery.isLoading,
    connect: connectMutation.mutate,
    importLibrary: importMutation.mutateAsync,
    isImporting: importMutation.isPending,
    importResult: importMutation.data ?? null,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
  }
}
