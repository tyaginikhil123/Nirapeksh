export type LiveVideo = {
  id: string
  title: string
  thumbnail: string
  url: string
}

const CACHE_PREFIX = 'nirpeksh-yt-videos:'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // refresh every 6 hours
const TOP_N = 4
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

async function fetchViaYoutubeApi(channelId: string): Promise<LiveVideo[]> {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined
  if (!key) return []

  const playlistId = uploadsPlaylistId(channelId)
  if (!playlistId) return []

  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('playlistId', playlistId)
  url.searchParams.set('maxResults', String(TOP_N))
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
    .slice(0, TOP_N)
}

/** CORS-friendly RSS → JSON bridge (no API key). Uses YouTube public uploads feed. */
async function fetchViaRssBridge(channelId: string): Promise<LiveVideo[]> {
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
    if (videos.length >= TOP_N) break
  }
  return videos
}

export async function fetchLatestVideos(channelId: string): Promise<LiveVideo[]> {
  if (!channelId) return []

  const cached = readCache(channelId)
  if (cached?.length) return cached

  const existing = inflight.get(channelId)
  if (existing) return existing

  const request = (async () => {
    return withLimit(async () => {
      let videos = await fetchViaYoutubeApi(channelId)
      if (!videos.length) {
        try {
          videos = await fetchViaRssBridge(channelId)
        } catch (error) {
          console.warn('RSS bridge failed for', channelId, error)
        }
      }
      if (videos.length) writeCache(channelId, videos)
      return videos
    })
  })()

  inflight.set(channelId, request)
  try {
    return await request
  } finally {
    inflight.delete(channelId)
  }
}
