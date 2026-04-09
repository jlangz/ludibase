import Parser from 'rss-parser'

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['enclosure', 'enclosure', { keepArray: false }],
    ],
  },
})

export interface NewsItem {
  title: string
  link: string
  description: string
  pubDate: string
  source: string
  imageUrl: string | null
}

const FEEDS = [
  { url: 'https://feeds.ign.com/ign/all', source: 'IGN' },
  { url: 'https://www.gamespot.com/feeds/mashup/', source: 'GameSpot' },
  { url: 'https://kotaku.com/rss', source: 'Kotaku' },
  { url: 'https://www.pcgamer.com/rss/', source: 'PC Gamer' },
  { url: 'https://www.polygon.com/rss/index.xml', source: 'Polygon' },
  { url: 'https://www.rockpapershotgun.com/feed/', source: 'Rock Paper Shotgun' },
]

let cache: { items: NewsItem[]; fetchedAt: number } | null = null
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function extractImage(item: Record<string, unknown>): string | null {
  // Try common RSS image fields
  const media = item.mediaContent as Record<string, unknown> | undefined
  if (media?.$ && (media.$ as Record<string, string>).url) {
    return (media.$ as Record<string, string>).url
  }

  const thumb = item.mediaThumbnail as Record<string, unknown> | undefined
  if (thumb?.$ && (thumb.$ as Record<string, string>).url) {
    return (thumb.$ as Record<string, string>).url
  }

  const enclosure = item.enclosure as Record<string, unknown> | undefined
  if (enclosure?.url && typeof enclosure.url === 'string' && enclosure.url.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
    return enclosure.url
  }

  // Try extracting from content/description HTML
  const content = (item.content || item['content:encoded'] || item.summary || '') as string
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch) return imgMatch[1]

  return null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim()
}

async function fetchFeed(url: string, source: string): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(url)
    return (feed.items || []).slice(0, 10).map((item) => ({
      title: item.title ?? '',
      link: item.link ?? '',
      description: stripHtml((item.contentSnippet || item.content || item.summary || '').slice(0, 300)),
      pubDate: item.isoDate ?? item.pubDate ?? '',
      source,
      imageUrl: extractImage(item as unknown as Record<string, unknown>),
    }))
  } catch (err) {
    console.warn(`[News] Failed to fetch ${source}: ${err instanceof Error ? err.message : err}`)
    return []
  }
}

export async function getNews(limit = 20): Promise<NewsItem[]> {
  // Return cached if fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.items.slice(0, limit)
  }

  // Fetch all feeds in parallel
  const results = await Promise.all(
    FEEDS.map((f) => fetchFeed(f.url, f.source))
  )

  // Merge and sort by date (newest first)
  const all = results
    .flat()
    .filter((item) => item.title && item.link)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  // Deduplicate by title (similar headlines from different sources)
  const seen = new Set<string>()
  const deduped = all.filter((item) => {
    const key = item.title.toLowerCase().slice(0, 60)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  cache = { items: deduped, fetchedAt: Date.now() }
  return deduped.slice(0, limit)
}
