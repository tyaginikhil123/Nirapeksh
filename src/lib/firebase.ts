import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
)

let app: FirebaseApp | null = null
let auth: Auth | null = null

function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured')
  }
  if (!app) {
    app = initializeApp({
      apiKey: firebaseConfig.apiKey!,
      authDomain: firebaseConfig.authDomain!,
      projectId: firebaseConfig.projectId!,
      appId: firebaseConfig.appId!,
    })
    auth = getAuth(app)
  }
  return auth!
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  if (!isFirebaseConfigured) {
    callback(null)
    return () => undefined
  }
  return onAuthStateChanged(getFirebaseAuth(), callback)
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return signInWithPopup(getFirebaseAuth(), provider)
}

export async function signOutUser() {
  if (!isFirebaseConfigured) return
  await signOut(getFirebaseAuth())
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const current = getFirebaseAuth().currentUser
  if (!current) return null
  return current.getIdToken(forceRefresh)
}

export type { User }
