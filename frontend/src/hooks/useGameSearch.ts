import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchGames } from '../lib/api'

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(timeoutRef.current)
    const trimmed = value.trim()
    // Clear immediately (0ms) when below threshold, otherwise debounce
    const delay = trimmed.length < 2 ? 0 : delayMs
    const next = trimmed.length < 2 ? '' : trimmed
    timeoutRef.current = setTimeout(() => setDebounced(next), delay)
    return () => clearTimeout(timeoutRef.current)
  }, [value, delayMs])

  return debounced
}

export function useGameSearch(debounceMs = 300) {
  const [input, setInput] = useState('')
  const debouncedQuery = useDebouncedValue(input, debounceMs)

  const { data: results = [], isLoading, error } = useQuery({
    queryKey: ['gameSearch', debouncedQuery],
    queryFn: () => searchGames(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  })

  return { input, setInput, results, isLoading, error, query: debouncedQuery }
}
