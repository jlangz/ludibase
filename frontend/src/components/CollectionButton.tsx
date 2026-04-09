import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { addToCollection, removeFromCollection, checkCollection } from '../lib/api'
import { PLATFORMS } from '../constants/gaming'
import { Plus, Check } from 'lucide-react'

interface CollectionButtonProps {
  igdbId: number
  /** Which platforms this game is available on (from game data) — used to filter the picker */
  gamePlatforms?: string[]
  size?: 'sm' | 'md'
}

export function CollectionButton({ igdbId, gamePlatforms, size = 'md' }: CollectionButtonProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showPicker, setShowPicker] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const pickerRef = useRef<HTMLDivElement>(null)

  const { data: checkResult } = useQuery({
    queryKey: ['collectionCheck', String(igdbId)],
    queryFn: () => checkCollection([igdbId]),
    enabled: !!user,
    staleTime: 60_000,
  })

  const inCollection = checkResult?.[igdbId] ?? false

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPicker])

  const addMutation = useMutation({
    mutationFn: (platforms: string[]) => addToCollection(igdbId, platforms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectionCheck'] })
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      setShowPicker(false)
      setSelectedPlatforms([])
    },
  })

  const removeMutation = useMutation({
    mutationFn: () => removeFromCollection(igdbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectionCheck'] })
      queryClient.invalidateQueries({ queryKey: ['collection'] })
    },
  })

  if (!user) return null

  const isPending = addMutation.isPending || removeMutation.isPending

  // Filter platform options to only those this game supports (if known)
  const platformOptions = gamePlatforms && gamePlatforms.length > 0
    ? PLATFORMS.filter((p) => gamePlatforms.includes(p.value))
    : PLATFORMS

  function togglePlatform(value: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    )
  }

  function handleAddClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (inCollection) {
      removeMutation.mutate()
    } else {
      setShowPicker(true)
    }
  }

  function handleConfirmAdd() {
    addMutation.mutate(selectedPlatforms)
  }

  // Small variant — just an icon button
  if (size === 'sm') {
    return (
      <div className="relative" ref={pickerRef}>
        <button
          onClick={handleAddClick}
          disabled={isPending}
          className={`cursor-pointer rounded p-1 transition-colors ${
            inCollection
              ? 'text-green-400 hover:text-red-400'
              : 'text-gray-500 hover:text-blue-400'
          }`}
          title={inCollection ? 'Remove from collection' : 'Add to collection'}
        >
          {inCollection ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
        {showPicker && <PlatformPicker options={platformOptions} selected={selectedPlatforms} onToggle={togglePlatform} onConfirm={handleConfirmAdd} isPending={isPending} />}
      </div>
    )
  }

  // Standard variant
  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={handleAddClick}
        disabled={isPending}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          inCollection
            ? 'bg-green-900/40 text-green-400 hover:bg-red-900/40 hover:text-red-400'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {inCollection ? (
          <>
            <Check className="h-4 w-4" />
            In Collection
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Add to Collection
          </>
        )}
      </button>
      {showPicker && <PlatformPicker options={platformOptions} selected={selectedPlatforms} onToggle={togglePlatform} onConfirm={handleConfirmAdd} isPending={isPending} />}
    </div>
  )
}

function PlatformPicker({
  options,
  selected,
  onToggle,
  onConfirm,
  isPending,
}: {
  options: readonly { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  onConfirm: () => void
  isPending: boolean
}) {
  return (
    <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl">
      <p className="mb-2 text-xs font-medium text-gray-400">Which platforms do you own it on?</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onToggle(p.value)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              selected.includes(p.value)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        onClick={onConfirm}
        disabled={isPending}
        className="mt-3 w-full rounded bg-blue-600 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Adding...' : 'Add to Collection'}
      </button>
    </div>
  )
}
