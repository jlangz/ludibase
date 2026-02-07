import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function useAvatarUpload() {
  const { user } = useAuth()
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function uploadAvatar(file: File): Promise<string | null> {
    if (!user) return null
    setError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPG, PNG, WebP, and GIF images are allowed')
      return null
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be under 2MB')
      return null
    }

    setIsUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // Append cache-buster so browsers show the new image
      return `${data.publicUrl}?t=${Date.now()}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      return null
    } finally {
      setIsUploading(false)
    }
  }

  async function removeAvatar(): Promise<boolean> {
    if (!user) return false
    setError(null)
    setIsUploading(true)

    try {
      // List files in the user's folder to find the current avatar
      const { data: files } = await supabase.storage
        .from('avatars')
        .list(user.id)

      if (files && files.length > 0) {
        const paths = files.map((f) => `${user.id}/${f.name}`)
        await supabase.storage.from('avatars').remove(paths)
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
      return false
    } finally {
      setIsUploading(false)
    }
  }

  return { uploadAvatar, removeAvatar, isUploading, error, clearError: () => setError(null) }
}
