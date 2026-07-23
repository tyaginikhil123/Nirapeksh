import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Connect, type Plugin } from 'vite'

type VoteMap = Record<string, number>

type ChannelRating = {
  sum: number
  count: number
  votes: VoteMap
}

type RatingsFile = Record<string, ChannelRating>

type Review = {
  uid: string
  name: string
  text: string
  createdAt: string
}

type ReviewsFile = Record<string, Review[]>

const DATA_DIR = path.resolve(process.cwd(), 'data')
const RATINGS_PATH = path.join(DATA_DIR, 'ratings.json')
const REVIEWS_PATH = path.join(DATA_DIR, 'reviews.json')
const CHANNELS_PATH = path.join(DATA_DIR, 'channels.json')

function getEnv(key: string) {
  const env = loadEnv(
    process.env.NODE_ENV === 'production' ? 'production' : 'development',
    process.cwd(),
    '',
  )
  return env[key] || process.env[key] || ''
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJson<T>(filePath: string, fallback: T): T {
  ensureDir()
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8')
    return fallback
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJson(filePath: string, value: unknown) {
  ensureDir()
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
}

function ensureStore(): RatingsFile {
  return readJson<RatingsFile>(RATINGS_PATH, {})
}

function saveStore(store: RatingsFile) {
  writeJson(RATINGS_PATH, store)
}

function ensureReviews(): ReviewsFile {
  return readJson<ReviewsFile>(REVIEWS_PATH, {})
}

function saveReviews(store: ReviewsFile) {
  writeJson(REVIEWS_PATH, store)
}

function ensureChannels(): unknown[] {
  const list = readJson<unknown[]>(CHANNELS_PATH, [])
  return Array.isArray(list) ? list : []
}

function saveChannels(channels: unknown[]) {
  writeJson(CHANNELS_PATH, channels)
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function getBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length).trim() || null
}

async function verifyFirebaseIdToken(idToken: string) {
  const apiKey = getEnv('VITE_FIREBASE_API_KEY')
  if (!apiKey) return null

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  )

  if (!res.ok) return null
  const data = (await res.json()) as {
    users?: Array<{ localId?: string; email?: string; displayName?: string }>
  }
  const user = data.users?.[0]
  if (!user?.localId) return null
  return {
    uid: user.localId,
    email: user.email,
    name: user.displayName || user.email || 'Viewer',
  }
}

function isAdminRequest(req: IncomingMessage) {
  const expected = getEnv('ADMIN_SECRET') || getEnv('VITE_ADMIN_SECRET')
  if (!expected) return false
  return req.headers['x-admin-secret'] === expected
}

function publicChannels(store: RatingsFile) {
  const channels: Record<string, { sum: number; count: number; average: number }> =
    {}
  for (const [id, value] of Object.entries(store)) {
    channels[id] = {
      sum: value.sum,
      count: value.count,
      average: value.count ? Math.round((value.sum / value.count) * 10) / 10 : 0,
    }
  }
  return channels
}

function mineForUser(store: RatingsFile, uid: string) {
  const mine: Record<string, number> = {}
  for (const [channelId, value] of Object.entries(store)) {
    if (value.votes[uid] != null) mine[channelId] = value.votes[uid]
  }
  return mine
}

function parseRssVideos(xml: string) {
  const videos: Array<{ id: string; title: string; thumbnail: string; url: string }> =
    []
  const entries = xml.split('<entry>').slice(1)

  for (const entry of entries.slice(0, 2)) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    const title = entry
      .match(/<media:title>([^<]*)<\/media:title>/)?.[1]
      ?.replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
    if (!id || !title) continue
    videos.push({
      id,
      title,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
    })
  }

  return videos
}

function extractAvatar(html: string): string | null {
  const match =
    html.match(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/) ||
    html.match(/https:\/\/yt3\.(?:ggpht|googleusercontent)\.com\/[^"=]+/)
  if (!match) return null
  const url = match[1] ?? match[0]
  return url.replace(/=s\d+-c-k-c0x00ffffff-no-rj.*/, '=s176-c-k-c0x00ffffff-no-rj')
}

async function fetchYoutubeMeta(channelId: string, handle: string) {
  const cleanHandle = handle.replace(/^@/, '')
  const fallbackAvatar = `https://unavatar.io/youtube/${cleanHandle}`
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  const pageUrl = `https://www.youtube.com/@${cleanHandle}`

  let videos: Array<{ id: string; title: string; thumbnail: string; url: string }> = []
  let avatar: string | null = fallbackAvatar

  try {
    const feedRes = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 NirapekshBot' },
    })
    if (feedRes.ok) videos = parseRssVideos(await feedRes.text())
  } catch (error) {
    console.warn(`YouTube feed failed for ${channelId}`, error)
  }

  try {
    const pageRes = await fetch(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 NirapekshBot' },
    })
    if (pageRes.ok) avatar = extractAvatar(await pageRes.text()) || fallbackAvatar
  } catch (error) {
    console.warn(`YouTube page failed for ${channelId}`, error)
  }

  return { avatar, videos }
}

function apiMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url ?? ''
    if (!url.startsWith('/api/')) return next()

    try {
      if (url.startsWith('/api/channels') && req.method === 'GET') {
        return sendJson(res, 200, { channels: ensureChannels() })
      }

      if (url.startsWith('/api/channels') && req.method === 'PUT') {
        if (!isAdminRequest(req)) {
          return sendJson(res, 401, { error: 'Admin secret required' })
        }
        const raw = await readBody(req)
        const body = JSON.parse(raw) as { channels?: unknown[] }
        if (!Array.isArray(body.channels)) {
          return sendJson(res, 400, { error: 'channels array required' })
        }
        saveChannels(body.channels)
        return sendJson(res, 200, { channels: body.channels })
      }

      if (url.startsWith('/api/reviews') && req.method === 'GET') {
        const channelId = new URL(url, 'http://localhost').searchParams.get(
          'channelId',
        )
        if (!channelId) return sendJson(res, 400, { error: 'channelId required' })
        const store = ensureReviews()
        return sendJson(res, 200, { reviews: store[channelId] ?? [] })
      }

      if (url.startsWith('/api/reviews') && req.method === 'POST') {
        const token = getBearerToken(req)
        if (!token) {
          return sendJson(res, 401, { error: 'Sign in to leave a review' })
        }
        const user = await verifyFirebaseIdToken(token)
        if (!user) {
          return sendJson(res, 401, { error: 'Invalid or expired login session' })
        }

        const raw = await readBody(req)
        const body = JSON.parse(raw) as { channelId?: string; text?: string }
        const channelId = body.channelId?.trim()
        const text = body.text?.trim() ?? ''

        if (!channelId) {
          return sendJson(res, 400, { error: 'channelId required' })
        }
        if (text.length > 280) {
          return sendJson(res, 400, { error: 'Review must be under 280 characters' })
        }

        const store = ensureReviews()
        const list = store[channelId] ?? []
        const nextList = list.filter((item) => item.uid !== user.uid)

        if (text.length > 0) {
          nextList.unshift({
            uid: user.uid,
            name: user.name,
            text,
            createdAt: new Date().toISOString(),
          })
        }

        store[channelId] = nextList.slice(0, 50)
        saveReviews(store)
        return sendJson(res, 200, { reviews: store[channelId] })
      }

      if (url.startsWith('/api/ratings') && req.method === 'GET') {
        const store = ensureStore()
        const token = getBearerToken(req)
        let mine: Record<string, number> = {}
        if (token) {
          const user = await verifyFirebaseIdToken(token)
          if (user) mine = mineForUser(store, user.uid)
        }
        return sendJson(res, 200, {
          channels: publicChannels(store),
          mine,
        })
      }

      if (url.startsWith('/api/ratings') && req.method === 'POST') {
        const token = getBearerToken(req)
        if (!token) {
          return sendJson(res, 401, {
            error: 'Sign in with Google to rate channels',
          })
        }

        const user = await verifyFirebaseIdToken(token)
        if (!user) {
          return sendJson(res, 401, { error: 'Invalid or expired login session' })
        }

        const raw = await readBody(req)
        const body = JSON.parse(raw) as {
          channelId?: string
          rating?: number
        }

        const channelId = body.channelId?.trim()
        const rating = Number(body.rating)

        if (!channelId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
          return sendJson(res, 400, { error: 'Invalid rating payload' })
        }

        const store = ensureStore()
        const current = store[channelId] ?? { sum: 0, count: 0, votes: {} }
        const previous = current.votes[user.uid]

        if (previous != null) {
          current.sum = current.sum - previous + rating
        } else {
          current.sum += rating
          current.count += 1
        }
        current.votes[user.uid] = rating
        store[channelId] = current
        saveStore(store)

        return sendJson(res, 200, {
          sum: current.sum,
          count: current.count,
          average: current.count
            ? Math.round((current.sum / current.count) * 10) / 10
            : 0,
          userRating: rating,
        })
      }

      const metaMatch = url.match(/^\/api\/youtube\/([^/?]+)\/meta/)
      if (metaMatch && req.method === 'GET') {
        const channelId = decodeURIComponent(metaMatch[1])
        const handle =
          new URL(url, 'http://localhost').searchParams.get('handle') ?? channelId
        const meta = await fetchYoutubeMeta(channelId, handle)
        return sendJson(res, 200, meta)
      }

      return sendJson(res, 404, { error: 'Not found' })
    } catch (error) {
      console.error(error)
      return sendJson(res, 500, { error: 'Server error' })
    }
  }
}

export function nirapekshApiPlugin(): Plugin {
  return {
    name: 'nirapeksh-api',
    configureServer(server) {
      server.middlewares.use(apiMiddleware())
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiMiddleware())
    },
  }
}
