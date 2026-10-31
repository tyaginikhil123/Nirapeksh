export type LiveVideo = {
  id: string
  title: string
  thumbnail: string
  url: string
  publishedAt?: string
}

const CACHE_PREFIX = 'nirpeksh-yt-videos:'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // refresh every 6 hours
const TOP_N = 4
export const CHANNEL_PAGE_VIDEOS = 12
const MAX_PARALLEL = 3

const inflight = new Map<string, Promise<LiveVideo[]>>()
let active = 0
const waitQueue: Array<() => void> = []

async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL) {
    await new Promise<void>((resolve) => waitQueue.push(resolve))
  }
  active += 1
  try {
    return await fn()
  } finally {
    active -= 1
    waitQueue.shift()?.()
  }
}

function uploadsPlaylistId(channelId: string): string | null {
  if (!channelId.startsWith('UC') || channelId.length < 3) return null
  return `UU${channelId.slice(2)}`
}

function toVideo(id: string, title: string, publishedAt?: string): LiveVideo {
  return {
    id,
    title,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${id}`,
    publishedAt,
  }
}

function readCache(channelId: string): LiveVideo[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + channelId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; videos: LiveVideo[] }
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null
    return parsed.videos
  } catch {
    return null
  }
}

/** Titles from session cache (filled after cards load latest videos). */
export function getCachedVideoTitles(youtubeChannelId: string): string[] {
  return readCache(youtubeChannelId)?.map((video) => video.title) ?? []
}

function writeCache(channelId: string, videos: LiveVideo[]) {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + channelId,
      JSON.stringify({ at: Date.now(), videos }),
    )
  } catch {
    /* ignore quota */
  }
}

async function fetchViaYoutubeApi(
  channelId: string,
  limit: number,
): Promise<LiveVideo[]> {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined
  if (!key) return []

  const playlistId = uploadsPlaylistId(channelId)
  if (!playlistId) return []

  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('playlistId', playlistId)
  url.searchParams.set('maxResults', String(limit))
  url.searchParams.set('key', key)

  const res = await fetch(url)
  if (!res.ok) {
    console.warn('YouTube API error', res.status, await res.text().catch(() => ''))
    return []
  }

  const data = (await res.json()) as {
    items?: Array<{
      snippet?: {
        title?: string
        publishedAt?: string
        resourceId?: { videoId?: string }
      }
    }>
  }

  return (data.items ?? [])
    .map((item) => {
      const id = item.snippet?.resourceId?.videoId
      const title = item.snippet?.title
      if (!id || !title || title === 'Private video' || title === 'Deleted video') {
        return null
      }
      return toVideo(id, title, item.snippet?.publishedAt)
    })
    .filter((video): video is LiveVideo => Boolean(video))
    .slice(0, limit)
}

/** CORS-friendly RSS → JSON bridge (no API key). Uses YouTube public uploads feed. */
async function fetchViaRssBridge(
  channelId: string,
  limit: number,
): Promise<LiveVideo[]> {
  const feed = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  const bridge = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`

  const res = await fetch(bridge)
  if (!res.ok) return []

  const data = (await res.json()) as {
    status?: string
    items?: Array<{
      title?: string
      link?: string
      guid?: string
      pubDate?: string
    }>
  }
  if (data.status !== 'ok' || !data.items?.length) return []

  const videos: LiveVideo[] = []
  for (const item of data.items) {
    const fromGuid = item.guid?.match(/:([a-zA-Z0-9_-]{6,})$/)?.[1]
    const fromLink = item.link?.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)?.[1]
    const id = fromGuid || fromLink
    const title = item.title?.trim()
    if (!id || !title) continue
    const published = item.pubDate ? new Date(item.pubDate) : null
    videos.push(
      toVideo(
        id,
        title,
        published && Number.isFinite(published.getTime())
          ? published.toISOString()
          : undefined,
      ),
    )
    if (videos.length >= limit) break
  }
  return videos
}

export async function fetchLatestVideos(
  channelId: string,
  limit = TOP_N,
): Promise<LiveVideo[]> {
  if (!channelId) return []

  const cached = readCache(channelId)
  if (cached && cached.length >= limit) return cached.slice(0, limit)

  const inflightKey = `${channelId}:${limit}`
  const existing = inflight.get(inflightKey)
  if (existing) return existing

  const request = (async () => {
    return withLimit(async () => {
      let videos = await fetchViaYoutubeApi(channelId, limit)
      if (!videos.length) {
        try {
          videos = await fetchViaRssBridge(channelId, limit)
        } catch (error) {
          console.warn('RSS bridge failed for', channelId, error)
        }
      }
      if (videos.length) writeCache(channelId, videos)
      return videos.slice(0, limit)
    })
  })()

  inflight.set(inflightKey, request)
  try {
    return await request
  } finally {
    inflight.delete(inflightKey)
  }
}

export type YoutubeSearchResult = LiveVideo & {
  channelTitle: string
  channelId?: string
  duration?: string
  viewCount?: number
  publishedAt?: string
}

export type YoutubeChannelResult = {
  id: string
  title: string
  description: string
  thumbnail: string
  url: string
}

const GUEST_PREFIX = 'nirpeksh-guest-channel:'
const GUEST_VIDEO_PREFIX = 'nirpeksh-guest-video:'

export function rememberGuestChannel(channel: YoutubeChannelResult) {
  try {
    sessionStorage.setItem(GUEST_PREFIX + channel.id, JSON.stringify(channel))
  } catch {
    /* ignore quota */
  }
}

export function readGuestChannel(youtubeId: string): YoutubeChannelResult | null {
  try {
    const raw = sessionStorage.getItem(GUEST_PREFIX + youtubeId)
    if (!raw) return null
    return JSON.parse(raw) as YoutubeChannelResult
  } catch {
    return null
  }
}

export function rememberGuestVideo(video: YoutubeSearchResult) {
  try {
    sessionStorage.setItem(GUEST_VIDEO_PREFIX + video.id, JSON.stringify(video))
  } catch {
    /* ignore quota */
  }
}

export function readGuestVideo(videoId: string): YoutubeSearchResult | null {
  try {
    const raw = sessionStorage.getItem(GUEST_VIDEO_PREFIX + videoId)
    if (!raw) return null
    return JSON.parse(raw) as YoutubeSearchResult
  } catch {
    return null
  }
}

function youtubeKey(): string | undefined {
  return import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined
}

/** Channel search when the local directory has no matches. */
export async function searchYoutubeChannels(
  query: string,
  maxResults = 6,
): Promise<YoutubeChannelResult[]> {
  const key = youtubeKey()
  const q = query.trim()
  if (!key || !q) return []

  return withLimit(async () => {
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('q', q)
    url.searchParams.set('type', 'channel')
    url.searchParams.set('maxResults', String(maxResults))
    url.searchParams.set('relevanceLanguage', 'hi')
    url.searchParams.set('regionCode', 'IN')
    url.searchParams.set('safeSearch', 'moderate')
    url.searchParams.set('key', key)

    const res = await fetch(url)
    if (!res.ok) {
      console.warn('YouTube channel search error', res.status)
      return []
    }

    const data = (await res.json()) as {
      items?: Array<{
        id?: { channelId?: string }
        snippet?: {
          title?: string
          description?: string
          channelId?: string
          thumbnails?: {
            default?: { url?: string }
            medium?: { url?: string }
            high?: { url?: string }
          }
        }
      }>
    }

    return (data.items ?? [])
      .map((item) => {
        const id = item.id?.channelId || item.snippet?.channelId
        const title = item.snippet?.title?.trim()
        if (!id || !title) return null
        const thumbs = item.snippet?.thumbnails
        return {
          id,
          title,
          description: item.snippet?.description?.trim() || '',
          thumbnail:
            thumbs?.medium?.url || thumbs?.high?.url || thumbs?.default?.url || '',
          url: `https://www.youtube.com/channel/${id}`,
        }
      })
      .filter((item): item is YoutubeChannelResult => Boolean(item))
  })
}

type YoutubeSearchOptions = {
  regionCode?: string
  relevanceLanguage?: string | null
  channelId?: string
  order?: 'date' | 'relevance' | 'viewCount'
}

function mapSearchItem(item: {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    channelTitle?: string
    channelId?: string
    publishedAt?: string
    thumbnails?: { medium?: { url?: string }; high?: { url?: string } }
  }
}): YoutubeSearchResult | null {
  const id = item.id?.videoId
  const title = item.snippet?.title?.trim()
  if (!id || !title) return null
  const video = toVideo(id, title, item.snippet?.publishedAt)
  return {
    ...video,
    thumbnail:
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.high?.url ||
      video.thumbnail,
    channelTitle: item.snippet?.channelTitle?.trim() || 'YouTube',
    channelId: item.snippet?.channelId,
    publishedAt: item.snippet?.publishedAt,
  }
}

function formatIsoDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''
  const hours = Number(match[1] || 0)
  const minutes = Number(match[2] || 0)
  const seconds = Number(match[3] || 0)
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatViewCount(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`
  return String(count)
}

export function formatPublishedAt(iso: string, lang: 'en' | 'hi' = 'en'): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ''
  const seconds = Math.max(1, Math.round((Date.now() - then) / 1000))
  const hi = lang === 'hi'
  if (seconds < 60) return hi ? 'अभी' : 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return hi ? `${minutes} मिनट पहले` : `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return hi ? `${hours} घंटे पहले` : `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  const days = Math.round(hours / 24)
  if (days < 7) {
    return hi ? `${days} दिन पहले` : `${days} day${days === 1 ? '' : 's'} ago`
  }
  const weeks = Math.round(days / 7)
  if (weeks < 5) {
    return hi ? `${weeks} सप्ताह पहले` : `${weeks} week${weeks === 1 ? '' : 's'} ago`
  }
  const months = Math.round(days / 30)
  if (months < 12) {
    return hi ? `${months} माह पहले` : `${months} month${months === 1 ? '' : 's'} ago`
  }
  const years = Math.round(days / 365)
  return hi ? `${years} साल पहले` : `${years} year${years === 1 ? '' : 's'} ago`
}

async function hydrateVideoStats(
  videos: YoutubeSearchResult[],
): Promise<YoutubeSearchResult[]> {
  const key = youtubeKey()
  const ids = [...new Set(videos.map((video) => video.id).filter(Boolean))]
  if (!key || ids.length === 0) return videos

  const stats = new Map<
    string,
    { duration?: string; viewCount?: number; publishedAt?: string }
  >()

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    await withLimit(async () => {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos')
      url.searchParams.set('part', 'contentDetails,statistics,snippet')
      url.searchParams.set('id', chunk.join(','))
      url.searchParams.set('key', key)
      const res = await fetch(url)
      if (!res.ok) return
      const data = (await res.json()) as {
        items?: Array<{
          id?: string
          snippet?: { publishedAt?: string }
          contentDetails?: { duration?: string }
          statistics?: { viewCount?: string }
        }>
      }
      for (const item of data.items ?? []) {
        if (!item.id) continue
        const duration = item.contentDetails?.duration
          ? formatIsoDuration(item.contentDetails.duration)
          : undefined
        const views = item.statistics?.viewCount
        stats.set(item.id, {
          duration,
          viewCount: views ? Number(views) : undefined,
          publishedAt: item.snippet?.publishedAt,
        })
      }
    })
  }

  return videos.map((video) => {
    const extra = stats.get(video.id)
    if (!extra) return video
    return {
      ...video,
      duration: extra.duration ?? video.duration,
      viewCount: extra.viewCount ?? video.viewCount,
      publishedAt: extra.publishedAt ?? video.publishedAt,
    }
  })
}

/** Topic / keyword search — same ranking idea as YouTube search by name. */
export async function searchYoutubeVideos(
  query: string,
  maxResults = 8,
  options: YoutubeSearchOptions = {},
): Promise<YoutubeSearchResult[]> {
  const key = youtubeKey()
  const q = query.trim()
  if (!key || (!q && !options.channelId)) return []

  const mapped = await withLimit(async () => {
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('type', 'video')
    url.searchParams.set('maxResults', String(Math.min(maxResults, 50)))
    url.searchParams.set('regionCode', options.regionCode ?? 'IN')
    url.searchParams.set('safeSearch', 'moderate')
    url.searchParams.set('key', key)
    if (q) url.searchParams.set('q', q)
    if (options.channelId) url.searchParams.set('channelId', options.channelId)
    if (options.order) url.searchParams.set('order', options.order)
    if (options.relevanceLanguage !== null) {
      url.searchParams.set(
        'relevanceLanguage',
        options.relevanceLanguage ?? 'hi',
      )
    }

    const res = await fetch(url)
    if (!res.ok) {
      console.warn('YouTube search error', res.status)
      return [] as YoutubeSearchResult[]
    }

    const data = (await res.json()) as {
      items?: Array<Parameters<typeof mapSearchItem>[0]>
    }

    return (data.items ?? [])
      .map(mapSearchItem)
      .filter((item): item is YoutubeSearchResult => Boolean(item))
  })
  return hydrateVideoStats(mapped)
}

export async function fetchPopularYoutubeVideos(
  maxResults = 24,
): Promise<YoutubeSearchResult[]> {
  const key = youtubeKey()
  if (!key) return []

  return withLimit(async () => {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos')
    url.searchParams.set('part', 'snippet,contentDetails,statistics')
    url.searchParams.set('chart', 'mostPopular')
    url.searchParams.set('regionCode', 'IN')
    url.searchParams.set('maxResults', String(Math.min(maxResults, 50)))
    url.searchParams.set('key', key)

    const res = await fetch(url)
    if (!res.ok) {
      console.warn('YouTube popular videos error', res.status)
      return []
    }

    const data = (await res.json()) as {
      items?: Array<{
        id?: string
        snippet?: {
          title?: string
          channelTitle?: string
          channelId?: string
          publishedAt?: string
          thumbnails?: { medium?: { url?: string }; high?: { url?: string } }
        }
        contentDetails?: { duration?: string }
        statistics?: { viewCount?: string }
      }>
    }

    const list: YoutubeSearchResult[] = []
    for (const item of data.items ?? []) {
      const mapped = mapSearchItem({
        id: { videoId: item.id },
        snippet: item.snippet,
      })
      if (!mapped) continue
      if (item.contentDetails?.duration) {
        mapped.duration = formatIsoDuration(item.contentDetails.duration)
      }
      if (item.statistics?.viewCount) {
        mapped.viewCount = Number(item.statistics.viewCount)
      }
      list.push(mapped)
    }
    return list
  })
}

export async function fetchYoutubeVideo(
  videoId: string,
): Promise<YoutubeSearchResult | null> {
  const key = youtubeKey()
  const id = videoId.trim()
  if (!key || !id) return readGuestVideo(id)

  return withLimit(async () => {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos')
    url.searchParams.set('part', 'snippet,contentDetails,statistics')
    url.searchParams.set('id', id)
    url.searchParams.set('key', key)

    const res = await fetch(url)
    if (!res.ok) return readGuestVideo(id)

    const data = (await res.json()) as {
      items?: Array<{
        id?: string
        snippet?: {
          title?: string
          channelTitle?: string
          channelId?: string
          publishedAt?: string
          thumbnails?: { medium?: { url?: string }; high?: { url?: string } }
        }
        contentDetails?: { duration?: string }
        statistics?: { viewCount?: string }
      }>
    }
    const item = data.items?.[0]
    const mapped = item
      ? mapSearchItem({ id: { videoId: item.id }, snippet: item.snippet })
      : null
    if (mapped && item?.contentDetails?.duration) {
      mapped.duration = formatIsoDuration(item.contentDetails.duration)
    }
    if (mapped && item?.statistics?.viewCount) {
      mapped.viewCount = Number(item.statistics.viewCount)
    }
    if (mapped) rememberGuestVideo(mapped)
    return mapped ?? readGuestVideo(id)
  })
}

export function hasYoutubeApiKey(): boolean {
  return Boolean(youtubeKey())
}

const TITLE_NOISE =
  /\b(official|lyrics?|lyrical|video|song|songs|audio|full|movie|hd|4k|8k|remix|cover|status|whatsapp|slowed|reverb)\b/gi

function significantPhrase(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\[.*?\]/g, ' ')
    .split(/[|]/)[0]
    .replace(TITLE_NOISE, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isSameTrack(left: string, right: string): boolean {
  const a = significantPhrase(left)
  const b = significantPhrase(right)
  if (!a || !b) return false
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (short.length >= 10 && long.includes(short)) return true
  const aWords = a.split(' ').filter((word) => word.length >= 4)
  const bWords = new Set(b.split(' ').filter((word) => word.length >= 4))
  const distinctive = aWords.filter(
    (word, index) => index > 0 && bWords.has(word),
  )
  return distinctive.length >= 2
}

function relatedMixQuery(video: YoutubeSearchResult): string {
  if (/\b(song|songs|official|lyrics?|audio|music)\b/i.test(video.title)) {
    return 'latest hindi songs'
  }
  const words = significantPhrase(video.title)
    .split(' ')
    .filter((word) => word.length >= 4)
    .slice(0, 3)
  if (words.length >= 2) return words.join(' ')
  const channel = video.channelTitle.replace(/\s*[-|].*$/, '').trim()
  return channel ? `${channel} videos` : 'videos'
}

/** Up next: other videos from the channel plus a mix — not the same song on every row. */
export async function fetchRelatedYoutubeVideos(
  video: YoutubeSearchResult,
  limit = 16,
): Promise<YoutubeSearchResult[]> {
  const seen = new Set([video.id])
  const related: YoutubeSearchResult[] = []

  const take = (items: YoutubeSearchResult[], skipSameTrack: boolean) => {
    for (const item of items) {
      if (!item?.id || seen.has(item.id)) continue
      if (skipSameTrack && isSameTrack(video.title, item.title)) continue
      seen.add(item.id)
      related.push(item)
      if (related.length >= limit) return true
    }
    return false
  }

  const channelId = video.channelId
  const [fromChannel, mix, popular] = await Promise.all([
    channelId
      ? fetchLatestVideos(channelId, CHANNEL_PAGE_VIDEOS)
          .then((items) =>
            hydrateVideoStats(
              items.map((item) => ({
                ...item,
                channelTitle: video.channelTitle,
                channelId,
              })),
            ),
          )
          .catch(() => [] as YoutubeSearchResult[])
      : Promise.resolve([] as YoutubeSearchResult[]),
    searchYoutubeVideos(relatedMixQuery(video), 16, {
      relevanceLanguage: null,
    }).catch(() => [] as YoutubeSearchResult[]),
    fetchPopularYoutubeVideos(24).catch(() => [] as YoutubeSearchResult[]),
  ])

  if (take(fromChannel, true)) return related
  if (take(mix, true)) return related
  take(popular, false)
  return related
}

function parseSuggestPayload(payload: unknown): string[] {
  if (!Array.isArray(payload)) return []
  const rows = payload[1]
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => {
      if (typeof row === 'string') return row
      if (Array.isArray(row) && typeof row[0] === 'string') return row[0]
      return ''
    })
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)
}

/** YouTube-style name suggestions while typing (not a full video search). */
export async function searchYoutubeSuggestions(query: string): Promise<string[]> {
  const q = query.trim()
  if (q.length < 1) return []

  try {
    const res = await fetch(`/api/yt-suggest?q=${encodeURIComponent(q)}`)
    if (res.ok) {
      const data = (await res.json()) as { suggestions?: string[] }
      if (Array.isArray(data.suggestions) && data.suggestions.length) {
        return data.suggestions
      }
    }
  } catch {
    /* static hosting has no local API — fall through to JSONP */
  }

  return new Promise((resolve) => {
    const callback = `nirpekshYtSuggest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
    const script = document.createElement('script')
    const timer = window.setTimeout(() => finish([]), 3500)

    function finish(list: string[]) {
      window.clearTimeout(timer)
      delete (window as unknown as Record<string, unknown>)[callback]
      script.remove()
      resolve(list)
    }

    ;(window as unknown as Record<string, unknown>)[callback] = (payload: unknown) => {
      finish(parseSuggestPayload(payload))
    }

    script.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=en&gl=in&q=${encodeURIComponent(q)}&callback=${encodeURIComponent(callback)}`
    script.onerror = () => finish([])
    document.head.appendChild(script)
  })
}
