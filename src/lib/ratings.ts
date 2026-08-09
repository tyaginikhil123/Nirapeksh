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

export type RatingState = {
  sum: number
  count: number
  average: number
  userRating: number | null
}

export type SampleVideo = LiveVideo

export type ChannelMeta = {
  avatar: string | null
  videos: LiveVideo[]
}

function emptyState(userRating: number | null = null): RatingState {
  return { sum: 0, count: 0, average: 0, userRating }
}

function aggregateVotes(
  votes: { uid: string; rating: number }[],
  uid: string | null,
): RatingState {
  let sum = 0
  let count = 0
  let userRating: number | null = null
  for (const vote of votes) {
    sum += vote.rating
    count += 1
    if (uid && vote.uid === uid) userRating = vote.rating
  }
  return {
    sum,
    count,
    average: count ? Math.round((sum / count) * 10) / 10 : 0,
    userRating,
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
        const votes = snap.docs.map((item) => ({
          uid: item.id,
          rating: Number(item.data().rating) || 0,
        }))
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
  rating: number,
): Promise<RatingState> {
  const user = getCurrentUser()
  if (!user) throw new Error('Sign in required')
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Invalid rating')
  }

  await setDoc(doc(getDb(), 'ratings', channelId, 'votes', user.uid), {
    uid: user.uid,
    rating,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    updatedAt: new Date().toISOString(),
  })

  const snap = await getDocs(collection(getDb(), 'ratings', channelId, 'votes'))
  const votes = snap.docs.map((item) => ({
    uid: item.id,
    rating: Number(item.data().rating) || 0,
  }))
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

  // 1) Write / update all channels first so a failure never leaves an empty catalog.
  const writeBatchOp = writeBatch(database)
  for (const channel of channels) {
    writeBatchOp.set(doc(database, 'channels', channel.id), channel)
  }
  await writeBatchOp.commit()

  // 2) Only then remove channels that were dropped from the draft.
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

/** Returns Firestore channels when present; otherwise the local seed (no write). */
export async function loadChannelsOrSeed(seed: Channel[]): Promise<Channel[]> {
  if (!isFirebaseConfigured) return seed
  try {
    const existing = await fetchChannelsFromFirestore()
    return existing.length > 0 ? existing : seed
  } catch {
    return seed
  }
}
