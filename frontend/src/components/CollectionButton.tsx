import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useCollectionCheck } from '../hooks/useCollection'
import { addToCollection, removeFromCollection } from '../lib/api'
import { STOREFRONTS } from '../constants/gaming'
import { Plus, Check, Pencil, X, Trash2 } from 'lucide-react'

interface CollectionButtonProps {
  igdbId: number
  /** Which platforms this game is available on — used to filter the platform picker */
  gamePlatforms: string[]
  size?: 'sm' | 'md'
}

export function CollectionButton({ igdbId, gamePlatforms, size = 'md' }: CollectionButtonProps) {
  const { user } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const checkResult = useCollectionCheck([igdbId])
  const entry = checkResult[igdbId] ?? null
  const inCollection = entry !== null

  if (!user) return null

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setShowModal(true)
  }

  if (size === 'sm') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`cursor-pointer rounded p-1 transition-colors ${
            inCollection
              ? 'text-green-400 hover:text-blue-400'
              : 'text-gray-500 hover:text-blue-400'
          }`}
          title={inCollection ? 'Edit in collection' : 'Add to collection'}
        >
          {inCollection ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
        {showModal && (
          <CollectionModal
            igdbId={igdbId}
            gamePlatforms={gamePlatforms}
            entry={entry}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          inCollection
            ? 'bg-green-900/40 text-green-400 hover:bg-blue-900/40 hover:text-blue-400'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {inCollection ? (
          <>
            <Check className="h-4 w-4" />
            In Collection — Edit
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Add to Collection
          </>
        )}
      </button>
      {showModal && (
        <CollectionModal
          igdbId={igdbId}
          gamePlatforms={gamePlatforms}
          entry={entry}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

function CollectionModal({
  igdbId,
  gamePlatforms,
  entry,
  onClose,
}: {
  igdbId: number
  gamePlatforms: string[]
  entry: { ownedPlatforms: string[] | null; storefronts: string[] | null } | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const isEditing = entry !== null
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(entry?.ownedPlatforms ?? [])
  const [selectedStorefronts, setSelectedStorefronts] = useState<string[]>(entry?.storefronts ?? [])

  const saveMutation = useMutation({
    mutationFn: () => addToCollection(igdbId, selectedPlatforms, selectedStorefronts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectionCheck'] })
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      onClose()
    },
  })

  const removeMutation = useMutation({
    mutationFn: () => removeFromCollection(igdbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectionCheck'] })
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      onClose()
    },
  })

  const isPending = saveMutation.isPending || removeMutation.isPending
  const platformOptions = gamePlatforms.map((p) => ({ value: p, label: p }))

  function toggleItem(value: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Game in Collection' : 'Add to Collection'}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {/* Platforms */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-400">Platforms</p>
            <div className="flex flex-wrap gap-1.5">
              {platformOptions.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => toggleItem(p.value, selectedPlatforms, setSelectedPlatforms)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    selectedPlatforms.includes(p.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Storefronts */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-400">Storefronts</p>
            <div className="flex flex-wrap gap-1.5">
              {STOREFRONTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleItem(s.value, selectedStorefronts, setSelectedStorefronts)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    selectedStorefronts.includes(s.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-800 px-5 py-4">
          {isEditing ? (
            <button
              onClick={() => removeMutation.mutate()}
              disabled={isPending}
              className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={isPending}
            className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Add to Collection'}
          </button>
        </div>
      </div>
    </div>
  )
}
