import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { getDb, isFirebaseConfigured } from './firebase'

export type UserProfile = {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  lastLoginAt: string
  createdAt?: string
}

/** Upsert signed-in user into Firestore `users/{uid}`. */
export async function ensureUserProfile(user: User): Promise<void> {
  if (!isFirebaseConfigured) return

  const ref = doc(getDb(), 'users', user.uid)
  const existing = await getDoc(ref)
  const now = new Date().toISOString()

  await setDoc(
    ref,
    {
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      lastLoginAt: now,
      ...(existing.exists() ? {} : { createdAt: now }),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
