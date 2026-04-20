import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { getSavedArticles, saveArticle, unsaveArticle } from '../lib/api'
import type { NewsItem } from '../lib/api'

export function useSavedArticles(page = 1) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['savedArticles', user?.id, page],
    queryFn: () => getSavedArticles(page),
    enabled: !!user,
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: saveArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedArticles'] })
    },
  })

  const unsaveMutation = useMutation({
    mutationFn: unsaveArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedArticles'] })
    },
  })

  // Check if a URL is saved by looking at the cached saved list
  const savedUrls = new Set(
    query.data?.articles.map((a) => a.link) ?? []
  )

  return {
    data: query.data,
    isLoading: query.isLoading,
    isSaved: (url: string) => savedUrls.has(url),
    save: (article: NewsItem) => saveMutation.mutateAsync(article),
    unsave: (url: string) => unsaveMutation.mutateAsync(url),
    isSaving: saveMutation.isPending,
  }
}
