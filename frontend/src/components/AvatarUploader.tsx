import { useRef } from 'react'
import { useAvatarUpload } from '../hooks/useAvatarUpload'

interface AvatarUploaderProps {
  avatarUrl: string | null
  displayName: string | null
  onAvatarChange: (url: string | null) => void
}

export function AvatarUploader({ avatarUrl, displayName, onAvatarChange }: AvatarUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadAvatar, removeAvatar, isUploading, error } = useAvatarUpload()

  const initials = (displayName ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const url = await uploadAvatar(file)
    if (url) onAvatarChange(url)

    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  async function handleRemove() {
    const removed = await removeAvatar()
    if (removed) onAvatarChange(null)
  }

  return (
    <div className="flex items-center gap-5">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Avatar"
          className="h-20 w-20 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xl font-bold text-gray-500">
          {initials}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="rounded border border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isUploading}
              className="rounded border border-gray-700 px-3 py-1.5 text-sm text-red-400 hover:bg-gray-800 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <p className="text-xs text-gray-600">JPG, PNG, WebP, or GIF. Max 2MB.</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
