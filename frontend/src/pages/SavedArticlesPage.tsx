import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSavedArticles } from '../hooks/useSavedArticles'
import { Bookmark, ExternalLink, Trash2 } from 'lucide-react'

export function SavedArticlesPage() {
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const saved = useSavedArticles(page)

  if (!user) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-gray-400">Sign in to view saved articles</p>
        <Link to="/login" className="mt-4 inline-block text-sm text-blue-400 hover:underline">Log In</Link>
      </div>
    )
  }

  const articles = saved.data?.articles ?? []
  const total = saved.data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Bookmark className="h-6 w-6" />
          Saved Articles
        </h1>
        {total > 0 && (
          <span className="text-sm text-gray-500">{total} article{total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {saved.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-800" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">No saved articles yet</p>
          <Link to="/" className="mt-4 inline-block text-sm text-blue-400 hover:underline">
            Browse news on the homepage
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {articles.map((article) => (
              <div
                key={article.link}
                className="flex gap-4 rounded-lg border border-gray-800 bg-gray-900 p-3"
              >
                {article.imageUrl && (
                  <img
                    src={article.imageUrl}
                    alt=""
                    className="h-20 w-32 shrink-0 rounded object-cover"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight line-clamp-2">{article.title}</p>
                  {article.description && (
                    <p className="mt-1 text-sm text-gray-400 line-clamp-2">{article.description}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                    <span>{article.source}</span>
                    {article.pubDate && (
                      <>
                        <span>·</span>
                        <span>{formatTimeAgo(article.pubDate)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-blue-400"
                    title="Read article"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => saved.unsave(article.link)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-red-400"
                    title="Remove from saved"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border border-gray-700 px-3 py-1.5 text-sm disabled:opacity-30">Previous</button>
              <span className="px-3 text-sm text-gray-400">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded border border-gray-700 px-3 py-1.5 text-sm disabled:opacity-30">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
