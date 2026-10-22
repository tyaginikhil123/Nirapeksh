export type LiveVideo = {
  id: string
  title: string
  thumbnail: string
  url: string
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

function toVideo(id: string, title: string): LiveVideo {
  return {
    id,
    title,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${id}`,
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
      return toVideo(id, title)
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
    items?: Array<{ title?: string; link?: string; guid?: string }>
  }
  if (data.status !== 'ok' || !data.items?.length) return []

  const videos: LiveVideo[] = []
  for (const item of data.items) {
    const fromGuid = item.guid?.match(/:([a-zA-Z0-9_-]{6,})$/)?.[1]
    const fromLink = item.link?.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)?.[1]
    const id = fromGuid || fromLink
    const title = item.title?.trim()
    if (!id || !title) continue
    videos.push(toVideo(id, title))
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
}

function mapSearchItem(item: {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    channelTitle?: string
    channelId?: string
    thumbnails?: { medium?: { url?: string }; high?: { url?: string } }
  }
}): YoutubeSearchResult | null {
  const id = item.id?.videoId
  const title = item.snippet?.title?.trim()
  if (!id || !title) return null
  const video = toVideo(id, title)
  return {
    ...video,
    thumbnail:
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.high?.url ||
      video.thumbnail,
    channelTitle: item.snippet?.channelTitle?.trim() || 'YouTube',
    channelId: item.snippet?.channelId,
  }
}

/** Topic / keyword search — same ranking idea as YouTube search by name. */
export async function searchYoutubeVideos(
  query: string,
  maxResults = 8,
  options: YoutubeSearchOptions = {},
): Promise<YoutubeSearchResult[]> {
  const key = youtubeKey()
  const q = query.trim()
  if (!key || !q) return []

  return withLimit(async () => {
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('q', q)
    url.searchParams.set('type', 'video')
    url.searchParams.set('maxResults', String(Math.min(maxResults, 50)))
    url.searchParams.set('regionCode', options.regionCode ?? 'IN')
    url.searchParams.set('safeSearch', 'moderate')
    url.searchParams.set('key', key)
    if (options.relevanceLanguage !== null) {
      url.searchParams.set(
        'relevanceLanguage',
        options.relevanceLanguage ?? 'hi',
      )
    }

    const res = await fetch(url)
    if (!res.ok) {
      console.warn('YouTube search error', res.status)
      return []
    }

    const data = (await res.json()) as {
      items?: Array<Parameters<typeof mapSearchItem>[0]>
    }

    return (data.items ?? [])
      .map(mapSearchItem)
      .filter((item): item is YoutubeSearchResult => Boolean(item))
  })
}

export async function fetchPopularYoutubeVideos(
  maxResults = 24,
): Promise<YoutubeSearchResult[]> {
  const key = youtubeKey()
  if (!key) return []

  return withLimit(async () => {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos')
    url.searchParams.set('part', 'snippet')
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
          thumbnails?: { medium?: { url?: string }; high?: { url?: string } }
        }
      }>
    }

    return (data.items ?? [])
      .map((item) =>
        mapSearchItem({
          id: { videoId: item.id },
          snippet: item.snippet,
        }),
      )
      .filter((item): item is YoutubeSearchResult => Boolean(item))
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
    url.searchParams.set('part', 'snippet')
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
          thumbnails?: { medium?: { url?: string }; high?: { url?: string } }
        }
      }>
    }
    const item = data.items?.[0]
    const mapped = item
      ? mapSearchItem({ id: { videoId: item.id }, snippet: item.snippet })
      : null
    if (mapped) rememberGuestVideo(mapped)
    return mapped ?? readGuestVideo(id)
  })
}

export function hasYoutubeApiKey(): boolean {
  return Boolean(youtubeKey())
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
