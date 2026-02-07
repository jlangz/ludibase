import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchGames } from '../lib/api'

export function useGameSearch(debounceMs = 300) {
  const [input, setInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    if (input.trim().length < 2) {
      setDebouncedQuery('')
      return
    }
    const timer = setTimeout(() => setDebouncedQuery(input.trim()), debounceMs)
    return () => clearTimeout(timer)
  }, [input, debounceMs])

  const { data: results = [], isLoading, error } = useQuery({
    queryKey: ['gameSearch', debouncedQuery],
    queryFn: () => searchGames(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  })

  return { input, setInput, results, isLoading, error, query: debouncedQuery }
}
