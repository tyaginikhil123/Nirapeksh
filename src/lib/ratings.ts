import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import type { Channel } from '../data/channels'
import { getCurrentUser, getDb, isFirebaseConfigured } from './firebase'
import { fetchLatestVideos, type LiveVideo } from './youtube'

export const TRUST_AXES = ['ground', 'clarity', 'fairness', 'consistency'] as const
export type TrustAxis = (typeof TRUST_AXES)[number]

export type AxisScores = Record<TrustAxis, number>

export type RatingState = {
  sum: number
  count: number
  average: number
  userRating: number | null
  /** Community averages per axis (0 if none). */
  axes: AxisScores
  /** Signed-in user's axis scores, if any. */
  userAxes: AxisScores | null
}

export type SampleVideo = LiveVideo

export type ChannelMeta = {
  avatar: string | null
  videos: LiveVideo[]
}

export const EMPTY_AXES: AxisScores = {
  ground: 0,
  clarity: 0,
  fairness: 0,
  consistency: 0,
}

function emptyState(userRating: number | null = null): RatingState {
  return {
    sum: 0,
    count: 0,
    average: 0,
    userRating,
    axes: { ...EMPTY_AXES },
    userAxes: null,
  }
}

function averageOfAxes(axes: AxisScores): number {
  const values = TRUST_AXES.map((key) => axes[key])
  const sum = values.reduce((acc, n) => acc + n, 0)
  return Math.round((sum / values.length) * 10) / 10
}

function parseAxes(raw: unknown): AxisScores | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const next = { ...EMPTY_AXES }
  for (const key of TRUST_AXES) {
    const value = Number(data[key])
    if (!Number.isInteger(value) || value < 1 || value > 5) return null
    next[key] = value
  }
  return next
}

type VoteRow = {
  uid: string
  rating: number
  axes: AxisScores | null
}

function aggregateVotes(votes: VoteRow[], uid: string | null): RatingState {
  let sum = 0
  let count = 0
  let userRating: number | null = null
  let userAxes: AxisScores | null = null
  const axisSums = { ...EMPTY_AXES }
  const axisCounts = { ...EMPTY_AXES }

  for (const vote of votes) {
    sum += vote.rating
    count += 1
    if (uid && vote.uid === uid) {
      userRating = vote.rating
      userAxes = vote.axes
    }
    if (vote.axes) {
      for (const key of TRUST_AXES) {
        axisSums[key] += vote.axes[key]
        axisCounts[key] += 1
      }
    }
  }

  const axes = { ...EMPTY_AXES }
  for (const key of TRUST_AXES) {
    axes[key] = axisCounts[key]
      ? Math.round((axisSums[key] / axisCounts[key]) * 10) / 10
      : 0
  }

  return {
    sum,
    count,
    average: count ? Math.round((sum / count) * 10) / 10 : 0,
    userRating,
    axes,
    userAxes,
  }
}

export function getAverage(state: RatingState): number {
  return state.average
}

export async function fetchAllRatings(
  channelIds: string[],
): Promise<Record<string, RatingState>> {
  const uid = getCurrentUser()?.uid ?? null
  const empty = Object.fromEntries(
    channelIds.map((id) => [id, emptyState(null)]),
  ) as Record<string, RatingState>

  if (!isFirebaseConfigured) return empty

  try {
    const next = { ...empty }
    await Promise.all(
      channelIds.map(async (channelId) => {
        const snap = await getDocs(
          collection(getDb(), 'ratings', channelId, 'votes'),
        )
        const votes = snap.docs.map((item) => {
          const data = item.data()
          return {
            uid: item.id,
            rating: Number(data.rating) || 0,
            axes: parseAxes(data.axes),
          }
        })
        next[channelId] = aggregateVotes(votes, uid)
      }),
    )
    return next
  } catch (error) {
    console.warn('Failed to load ratings', error)
    return empty
  }
}

export async function submitAuthenticatedRating(
  channelId: string,
  ratingOrAxes: number | AxisScores,
): Promise<RatingState> {
  const user = getCurrentUser()
  if (!user) throw new Error('Sign in required')

  let rating: number
  let axes: AxisScores | null = null

  if (typeof ratingOrAxes === 'number') {
    if (!Number.isInteger(ratingOrAxes) || ratingOrAxes < 1 || ratingOrAxes > 5) {
      throw new Error('Invalid rating')
    }
    rating = ratingOrAxes
    // Quick star: mirror overall onto all axes so multi-axis charts stay filled.
    axes = {
      ground: rating,
      clarity: rating,
      fairness: rating,
      consistency: rating,
    }
  } else {
    for (const key of TRUST_AXES) {
      const value = ratingOrAxes[key]
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw new Error('Invalid axis rating')
      }
    }
    axes = { ...ratingOrAxes }
    rating = Math.round(averageOfAxes(axes))
  }

  await setDoc(doc(getDb(), 'ratings', channelId, 'votes', user.uid), {
    uid: user.uid,
    rating,
    axes,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    updatedAt: new Date().toISOString(),
  })

  const snap = await getDocs(collection(getDb(), 'ratings', channelId, 'votes'))
  const votes = snap.docs.map((item) => {
    const data = item.data()
    return {
      uid: item.id,
      rating: Number(data.rating) || 0,
      axes: parseAxes(data.axes),
    }
  })
  return aggregateVotes(votes, user.uid)
}

export async function fetchChannelMeta(
  channelId: string,
  handle: string,
): Promise<ChannelMeta> {
  const videos = await fetchLatestVideos(channelId)
  return {
    avatar: `https://unavatar.io/youtube/${handle.replace(/^@/, '')}`,
    videos,
  }
}

export async function fetchChannelsFromFirestore(): Promise<Channel[]> {
  if (!isFirebaseConfigured) return []
  const snap = await getDocs(collection(getDb(), 'channels'))
  return snap.docs
    .map((item) => ({ id: item.id, ...(item.data() as DocumentData) }) as Channel)
    .sort((a, b) => a.name.localeCompare(b.name))
}

function assertValidChannel(channel: Channel, index: number) {
  if (!channel.id?.trim()) {
    throw new Error(`Channel #${index + 1} is missing an id`)
  }
  if (!channel.name?.trim()) {
    throw new Error(`Channel "${channel.id}" is missing a name`)
  }
  if (!channel.channelId?.trim()) {
    throw new Error(`Channel "${channel.name}" is missing a YouTube channelId`)
  }
  if (!Array.isArray(channel.tags)) {
    throw new Error(`Channel "${channel.name}" tags must be an array`)
  }
  if (!Array.isArray(channel.sampleVideos)) {
    throw new Error(`Channel "${channel.name}" sampleVideos must be an array`)
  }
}

/** Upsert channels first, then delete only removed ids (never wipe-then-write). */
export async function saveChannelsToFirestore(channels: Channel[]): Promise<Channel[]> {
  const user = getCurrentUser()
  if (!user) throw new Error('Sign in with admin account required')
  if (!Array.isArray(channels) || channels.length === 0) {
    throw new Error('Channel list cannot be empty')
  }

  channels.forEach(assertValidChannel)

  const ids = channels.map((channel) => channel.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate channel ids in the list')
  }

  const database = getDb()
  const existing = await getDocs(collection(database, 'channels'))
  const existingIds = new Set(existing.docs.map((item) => item.id))
  const nextIds = new Set(ids)

  const writeBatchOp = writeBatch(database)
  for (const channel of channels) {
    writeBatchOp.set(doc(database, 'channels', channel.id), channel)
  }
  await writeBatchOp.commit()

  const toDelete = [...existingIds].filter((id) => !nextIds.has(id))
  if (toDelete.length) {
    const deleteBatchOp = writeBatch(database)
    for (const id of toDelete) {
      deleteBatchOp.delete(doc(database, 'channels', id))
    }
    await deleteBatchOp.commit()
  }

  return channels
}

export async function loadChannelsOrSeed(seed: Channel[]): Promise<Channel[]> {
  if (!isFirebaseConfigured) return seed
  try {
    const existing = await fetchChannelsFromFirestore()
    return existing.length > 0 ? existing : seed
  } catch {
    return seed
  }
}
