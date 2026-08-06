import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore'
import { getCurrentUser, getDb, isFirebaseConfigured } from './firebase'
import {
  fetchChannelsFromFirestore,
  saveChannelsToFirestore,
} from './ratings'
import type { Channel } from '../data/channels'

export type TrustReview = {
  uid: string
  name: string
  email?: string | null
  photoURL?: string | null
  text: string
  createdAt: string
  updatedAt?: string
}

export async function fetchReviews(channelId: string): Promise<TrustReview[]> {
  if (!isFirebaseConfigured) return []
  try {
    const q = query(
      collection(getDb(), 'reviews', channelId, 'entries'),
      orderBy('createdAt', 'desc'),
    )
    const snap = await getDocs(q)
    return snap.docs.map((item) => item.data() as TrustReview)
  } catch (error) {
    console.warn('Failed to load reviews', error)
    return []
  }
}

export type ChannelReview = TrustReview & {
  channelId: string
}

/** Latest trust notes across channels (for Report). */
export async function fetchAllChannelReviews(
  channelIds: string[],
): Promise<ChannelReview[]> {
  if (!isFirebaseConfigured || channelIds.length === 0) return []

  const batches = await Promise.all(
    channelIds.map(async (channelId) => {
      const list = await fetchReviews(channelId)
      return list.map((review) => ({ ...review, channelId }))
    }),
  )

  return batches
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function submitReview(
  channelId: string,
  text: string,
): Promise<TrustReview[]> {
  const user = getCurrentUser()
  if (!user) throw new Error('Sign in required')

  const trimmed = text.trim()
  const ref = doc(getDb(), 'reviews', channelId, 'entries', user.uid)

  if (!trimmed) {
    await deleteDoc(ref)
  } else {
    if (trimmed.length > 280) throw new Error('Review must be under 280 characters')
    await setDoc(ref, {
      uid: user.uid,
      name: user.displayName || user.email || 'Viewer',
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
      text: trimmed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  return fetchReviews(channelId)
}

export async function fetchChannelsApi() {
  const channels = await fetchChannelsFromFirestore()
  return { channels }
}

export async function saveChannelsApi(channels: Channel[]) {
  const saved = await saveChannelsToFirestore(channels)
  return { channels: saved }
}

export async function submitFeedback(input: {
  name: string
  email: string
  message: string
}) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured')
  }
  const id = `fb-${Date.now()}`
  await setDoc(doc(getDb(), 'feedback', id), {
    ...input,
    createdAt: new Date().toISOString(),
  })
  return { ok: true, stored: true, emailed: false }
}
